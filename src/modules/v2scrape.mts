import { sleep, v2parse } from "./helper.mjs";
import { V2Object, Vless, Vmess } from "./types.mjs";
import fetch from "node-fetch";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { Bugs } from "./bugs.mjs";
import { spawn } from "child_process";
import { SocksProxyAgent } from "socks-proxy-agent";

class V2scrape {
  path = process.cwd();
  private sourceUrl = readFileSync(`${this.path}/source`).toString();
  private accounts: Array<V2Object> = [];
  private regions: Array<string> = [];

  async get() {
    process.stdout.write("Fetching accounts... ");
    const res = await fetch(this.sourceUrl, {
      method: "GET",
      follow: 1,
    });

    if (res.status != 200) {
      throw Error(res.statusText);
    }
    process.stdout.write("done!.\n");

    process.stdout.write("Parsing... \n");
    await this.parse(JSON.parse(await res.text()));

    process.stdout.write("Writing result...");
    writeFileSync(`${this.path}/result/result.json`, JSON.stringify(this.accounts, null, 2));
    process.stdout.write("done.!\n");
    console.log(`Result saved to ${this.path}/result/result.json`);
  }

  private async test(account: V2Object, mode: "sni" | "cdn" | string = "cdn"): Promise<V2Object> {
    const config = JSON.parse(readFileSync("./config/v2ray/config.json").toString());
    let port: number = 10802;
    const remark = `${mode}-${account.remark}`;

    if (mode == "cdn") {
      if (!account.host) {
        account.error = "No Host!";
        return account;
      }
      account.cdn = true;
      port = 20802;
    } else {
      account.tls = "tls";
      account.cdn = false;

      if (account.port == 80) account.port = 443;
    }

    config.inbounds[0].port = port - 1; // tproxy port
    config.inbounds[1].port = port; // socks port
    config.routing.rules[0].port = port - 2; // dns port

    const proxy = this.toV2ray(account, "promo.ruangguru.com", "main.millionaireaisle.com");
    config.outbounds.push(proxy);
    writeFileSync(`./config/v2ray/test-${mode}.json`, JSON.stringify(config, null, 2));

    const v2ray = spawn("./bin/v2ray", ["run", "-c", `./config/v2ray/test-${mode}.json`]);

    v2ray.stdout.on("data", (res: any) => {
      // console.log(res.toString());
      if (res.toString().match(/(context deadline exceeded|timeout|write on closed pipe)/i)) {
        account.error = "Could not connect to server!";
      }
    });

    await sleep(200);
    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      await fetch("http://ip-api.com/json", {
        agent: new SocksProxyAgent(`socks5://127.0.0.1:${port}`),
        signal: controller.signal,
      }).then(async (res) => {
        const data = JSON.parse(await res.text());
        if (data.status == "success") {
          account.region = ((data.timezone as string).match(/(.+)\//) || ["Other"])[1];
        }
      });
    } catch (e: any) {
      // console.log(e.message);
      if ((e.message as string).match("aborted")) {
        account.error = "Timeout!";
      }
    }

    await new Promise((resolve) => {
      v2ray.kill();

      v2ray.on("close", () => {
        resolve(0);
      });
    });

    clearTimeout(timeout);

    return {
      ...account,
      cdn: mode == "cdn" ? true : false,
      remark,
    };
  }

  private async parse(accounts: Array<string> | string) {
    if (!Array.isArray(accounts)) accounts = [accounts];

    for (let account of accounts) {
      let v2Account: V2Object;

      const vpn = (account.match(/^(.+):\/\//) || [""])[1];
      if (account.startsWith("vmess://")) {
        const vmess = v2parse(account) as Vmess;

        process;
        v2Account = {
          vpn,
          address: vmess.add,
          port: vmess.port,
          host: vmess.host,
          alterId: vmess.aid || 0,
          id: vmess.id,
          network: vmess.net,
          type: vmess.type,
          security: vmess.security,
          skipCertVerify: vmess["skip-cert-verify"] || true,
          tls: vmess.tls,
          sni: vmess.sni,
          path: vmess.path,
          remark: vmess.ps,
          cdn: vmess.cdn,
        };
      } else if (account.match(/^(vless|trojan)/)) {
        const vless = v2parse(account) as Vless;

        v2Account = {
          vpn,
          address: vless.server,
          port: vless.port,
          host: vless.host,
          alterId: 0,
          id: vless.id,
          network: vless.type,
          type: "",
          security: vless.encryption,
          skipCertVerify: true,
          tls: vless.security,
          sni: vless.sni,
          path: vless.path,
          remark: vless.remark,
          cdn: vless.cdn,
        };
      } else {
        v2Account = {} as V2Object;
      }

      if (v2Account.network != "ws") continue;

      if (v2Account.remark.match("default_name")) {
        v2Account.remark = `v2scrape-${this.accounts.length}`;
      } else {
        v2Account.remark = `${v2Account.remark.replace(/^.+ - /i, "").replace(" → openitsub.com", "")}-${
          this.accounts.length
        }`;
      }

      process.stdout.write(`${v2Account.remark}: `);
      const isConnected = await (async () => {
        const connectMode: Array<V2Object> = [];
        const onTest: Array<string> = [];

        for (const mode of ["sni", "cdn"]) {
          onTest.push(mode);
          this.test(v2Account, mode)
            .then((res) => {
              if (res) connectMode.push(res);
            })
            .finally(() => {
              if (onTest[0]) onTest.shift();
            });
          // await sleep(500);
        }

        do {
          await sleep(100);
        } while (onTest[0]);

        return connectMode;
      })();

      for (let connectMode of isConnected) {
        if (!connectMode.error) {
          if (!connectMode.region) connectMode.region = "Other";
          if (!this.regions.includes(connectMode.region)) this.regions.push(connectMode.region);

          this.accounts.push(connectMode);
          process.stdout.write(`${connectMode.cdn ? " CDN" : " SNI"} -> ${connectMode.region}`);
        } else {
          process.stdout.write(`${connectMode.cdn ? " CDN" : " SNI"} -> ${connectMode.error}`);
        }
      }
      process.stdout.write("\n");

      // if (this.accounts.length > 5) break; // test purpose
    }
  }

  convert(bugs: Bugs, bugBundle: string): Array<string> {
    const v2rayConfig = JSON.parse(readFileSync("./config/v2ray/config.json").toString());
    const clashProxies: Array<string> = ["proxies:"];
    const v2rayProxies: Array<Object> = [];
    const base64Proxies: Array<string> = [];
    let clashRegion: Array<{
      region: string;
      proxy: string;
    }> = [];

    for (const account of this.accounts) {
      const cdn = bugs.cdn;
      const sni = bugs.sni;

      const clashProxy = this.toClash(account, sni, cdn);
      const v2rayProxy = this.toV2ray(account, sni, cdn, v2rayProxies.length + 1);
      const base64Proxy = this.toBase64(account, sni, cdn);

      if (clashProxy) {
        clashProxies.push(clashProxy);
        clashRegion.push({
          region: account.region || "Other",
          proxy: clashProxy,
        });
      }
      if (v2rayProxy) v2rayProxies.push(v2rayProxy);
      if (base64Proxy) base64Proxies.push(base64Proxy);
    }

    // Split per region
    do {
      const proxiesPerFile = ["proxies:"];
      let currentRegion = "";
      for (let i = 0; i < clashRegion.length; i++) {
        if (!clashRegion[i]) continue;
        if (!currentRegion) currentRegion = clashRegion[i].region;

        if (clashRegion[i].region == currentRegion) {
          proxiesPerFile.push(clashRegion[i].proxy);
          delete clashRegion[i];
        }
      }

      writeFileSync(`./result/clash/providers-${bugBundle}-${currentRegion}.yaml`, proxiesPerFile.join("\n"));

      clashRegion = (() => {
        const filteredProxy = [];

        for (const proxy of clashRegion) {
          if (proxy) filteredProxy.push(proxy);
        }

        return filteredProxy;
      })();
    } while (clashRegion.length > 0);

    // Split for 4 files and write result
    let splitCount = 1;
    let proxyPerFile = Math.round((clashProxies.length - 1) / 4);
    let proxiesPerFile = ["proxies:"];
    for (let i = 1; i < clashProxies.length; i++) {
      proxiesPerFile.push(clashProxies[i]);

      // Save accounts left on the last providers
      if (clashProxies.length - 1 - i < proxyPerFile && splitCount >= 4) {
        proxyPerFile++;
      }

      if (proxiesPerFile.length - 1 >= proxyPerFile) {
        writeFileSync(`./result/clash/providers-${bugBundle}-${splitCount}.yaml`, proxiesPerFile.join("\n"));

        proxiesPerFile = ["proxies:"];
        splitCount++;
      }
    }
    if (proxiesPerFile.length > 1) {
      writeFileSync(`./result/clash/providers-${bugBundle}-${splitCount}.yaml`, proxiesPerFile.join("\n"));
    }

    // Write entire result
    v2rayConfig.outbounds.push(...v2rayProxies);
    writeFileSync(`./result/clash/providers-${bugBundle}.yaml`, clashProxies.join("\n"));
    writeFileSync(`./result/v2ray/config-${bugBundle}.json`, JSON.stringify(v2rayConfig, null, 2));

    return base64Proxies;
  }

  private toClash(account: V2Object, sni: string, cdn: string) {
    if (!existsSync(`${this.path}/result/clash`)) mkdirSync(`${this.path}/result/clash`);
    let proxy = [];

    if (account.vpn == "vmess") {
      proxy.push(`  - name: '${account.remark}'`);
      proxy.push(`    type: ${account.vpn}`);
      proxy.push(`    port: ${account.port}`);
      proxy.push(`    uuid: ${account.id}`);
      proxy.push(`    alterId: ${account.alterId}`);
      proxy.push(`    cipher: auto`);
      proxy.push(`    tls: ${account.tls ? true : false}`);
      proxy.push(`    udp: true`);
      proxy.push(`    skip-cert-verify: ${account.skipCertVerify}`);
      proxy.push(`    network: ${account.network}`);
      proxy.push(`    ws-opts: `);
      proxy.push(`      path: ${account.path}`);
      proxy.push(`      headers:`);
      if (account.cdn) {
        proxy.push(`        Host: ${account.host}`);
        proxy.push(`    servername: ${account.sni || account.host}`);
        proxy.push(`    server: ${cdn}`);
      } else {
        proxy.push(`        Host: ${sni}`);
        proxy.push(`    servername: ${sni}`);
        proxy.push(`    server: ${account.address}`);
      }
    } else if (account.vpn.startsWith("trojan")) {
      proxy.push(`  - name: '${account.remark}'`);
      proxy.push(`    type: ${account.vpn.replace("-go", "")}`);
      proxy.push(`    port: ${account.port}`);
      proxy.push(`    password: ${account.id}`);
      proxy.push(`    udp: true`);
      proxy.push(`    skip-cert-verify: ${account.skipCertVerify}`);
      proxy.push(`    network: ${account.network}`);
      proxy.push(`    ws-opts: `);
      proxy.push(`      path: ${account.path}`);
      proxy.push(`      headers:`);
      if (account.cdn) {
        proxy.push(`        Host: ${account.host}`);
        proxy.push(`    sni: ${account.sni || account.host}`);
        proxy.push(`    server: ${cdn}`);
      } else {
        proxy.push(`        Host: ${sni}`);
        proxy.push(`    sni: ${sni}`);
        proxy.push(`    server: ${account.address}`);
      }
    }

    return proxy.join("\n");
  }

  private toV2ray(account: V2Object, sni: string, cdn: string, i: number = 1) {
    if (!existsSync(`${this.path}/result/v2ray`)) mkdirSync(`${this.path}/result/v2ray`);
    const proxy = [];

    if (account.vpn == "vmess") {
      proxy.push({
        mux: {
          concurrency: 8,
          enabled: false,
        },
        protocol: "vmess",
        settings: {
          vnext: [
            {
              address: account.address,
              port: parseInt(`${account.port}` || "443"),
              users: [
                {
                  alterId: parseInt(`${account.alterId}` || "0"),
                  encryption: "",
                  flow: "",
                  id: account.id,
                  level: 8,
                  security: "auto",
                },
              ],
            },
          ],
        },
        streamSettings: {
          network: account.network,
          security: account.tls,
          wsSettings: {
            headers: {
              Host: account.host,
            },
            path: account.path,
          },
          tlsSettings: {
            allowInsecure: true,
            serverName: account.sni,
          },
        },
        tag: `proxy-${i}`,
      });

      if (account.cdn) {
        proxy[0].settings.vnext[0].address = cdn;
        proxy[0].streamSettings.tlsSettings.serverName = account.sni || account.host;
      } else {
        proxy[0].streamSettings.wsSettings.headers.Host = sni;
        proxy[0].streamSettings.tlsSettings.serverName = sni;
      }
    } else if (account.vpn.startsWith("trojan")) {
      proxy.push({
        mux: {
          concurrency: 8,
          enabled: false,
        },
        protocol: "trojan",
        settings: {
          servers: [
            {
              address: account.address,
              port: parseInt(`${account.port}` || "443"),
              flow: "",
              level: 8,
              method: "chacha20-poly1305",
              ota: false,
              password: account.id,
            },
          ],
        },
        streamSettings: {
          network: account.network,
          security: account.tls,
          wsSettings: {
            headers: {
              Host: account.host,
            },
            path: account.path,
          },
          tlsSettings: {
            allowInsecure: true,
            serverName: account.sni,
          },
        },
        tag: `proxy-${i}`,
      });

      if (account.cdn) {
        proxy[0].settings.servers[0].address = cdn;
        proxy[0].streamSettings.tlsSettings.serverName = account.sni || account.host;
      } else {
        proxy[0].streamSettings.wsSettings.headers.Host = sni;
        proxy[0].streamSettings.tlsSettings.serverName = sni;
      }
    }

    return proxy[0];
  }

  toBase64(account: V2Object, sni: string, cdn: string) {
    let vmess: Vmess = {
      add: account.address,
      aid: account.alterId,
      host: account.host,
      id: account.id,
      net: account.network,
      path: account.path,
      port: account.port,
      ps: account.remark,
      tls: account.tls,
      type: account.type,
      security: account.security,
      "skip-cert-verify": account.skipCertVerify,
      sni: account.sni,
      cdn: account.cdn,
    };

    if (account.cdn) {
      vmess.add = cdn;
      vmess.sni = account.sni || account.host;
    } else {
      vmess.host = sni;
      vmess.sni = sni;
    }

    return `${account.vpn}://${Buffer.from(JSON.stringify(vmess)).toString("base64")}`;
  }
}

const v2scrape = new V2scrape();
export { v2scrape };
