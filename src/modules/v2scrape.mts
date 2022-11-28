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

  private async test(account: V2Object, mode: "sni" | "cdn" | string = "cdn"): Promise<false | V2Object> {
    const config = JSON.parse(readFileSync("./config/v2ray/config.json").toString());
    let port: number = 10802;
    let isConnected: boolean = true;
    const remark = `${mode}-${account.remark}`;
    if (mode == "cdn") {
      account.cdn = true;
      port = 20802;
    } else {
      account.cdn = false;
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
        isConnected = false;
      }
    });

    await sleep(1000);
    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 1000);

    try {
      await fetch("https://youtube.com", {
        agent: new SocksProxyAgent(`socks5://127.0.0.1:${port}`),
        signal: controller.signal,
      });
    } catch (e: any) {
      // console.log(e.message);
      isConnected = false;
    }

    await new Promise((resolve) => {
      v2ray.kill();

      v2ray.on("close", () => {
        resolve(0);
      });
    });

    clearTimeout(timeout);

    if (isConnected)
      return {
        ...account,
        remark,
      };
    else return false;
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
          cdn: vmess.cdn,
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
        };
      } else if (account.match(/^(vless|trojan)/)) {
        const vless = v2parse(account) as Vless;

        v2Account = {
          vpn,
          cdn: vless.cdn,
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
        };
      } else {
        v2Account = {} as V2Object;
      }

      if (v2Account.network != "ws") continue;

      if (v2Account.remark.match("default_name")) {
        v2Account.remark = `v2scrape-${this.accounts.length}`;
      } else {
        v2Account.remark = v2Account.remark.replace(/^.+ - /i, "").replace(" → openitsub.com", "");
      }

      process.stdout.write(`${v2Account.remark}: `);
      const isConnected = await (async () => {
        const connectedMode: Array<V2Object> = [];
        const onTest: Array<string> = [];

        for (const mode of ["cdn", "sni"]) {
          onTest.push(mode);
          await this.test(v2Account, mode)
            .then((res) => {
              if (res) connectedMode.push(res);
            })
            .finally(() => {
              if (onTest[0]) onTest.shift();
            });
        }

        do {
          sleep(100);
        } while (onTest[0]);

        return connectedMode;
      })();

      if (isConnected.length > 0) {
        for (const connectedMode of isConnected) {
          if (connectedMode) {
            this.accounts.push(connectedMode);
            process.stdout.write(`${connectedMode.cdn ? " CDN" : " SNI"}`);
          }
        }
        process.stdout.write("\n");
      } else {
        process.stdout.write("Could not connect!\n");
      }
    }
  }

  convert(bugs: Bugs, bugBundle: string) {
    const v2rayConfig = JSON.parse(readFileSync("./config/v2ray/config.json").toString());
    const clashProxies: Array<string> = ["proxies:"];
    const v2rayProxies: Array<Object> = [];

    for (const account of this.accounts) {
      const cdn = bugs.cdn;
      const sni = bugs.sni;

      const clashProxy = this.toClash(account, sni, cdn);
      const v2rayProxy = this.toV2ray(account, sni, cdn, v2rayProxies.length + 1);

      if (clashProxy) clashProxies.push(clashProxy);
      if (v2rayProxy) v2rayProxies.push(v2rayProxy);
    }

    // Split for 4 files and write result
    let splitCount = 1;
    const proxyPerFile = Math.round((clashProxies.length - 1) / 4);
    let proxiesPerFile = ["proxies:"];
    for (let i = 1; i < clashProxies.length; i++) {
      proxiesPerFile.push(clashProxies[i]);

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
      if (account.remark.match(/cloudflare/i) || account.cdn) {
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
}

const v2scrape = new V2scrape();
export { v2scrape };
