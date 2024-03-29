import { sleep, v2parse } from "./helper.mjs";
import { Country, Region, V2Object, Vless, Vmess } from "./types.mjs";
import fetch from "node-fetch";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { Bugs } from "./bugs.mjs";
import { spawn } from "child_process";
import { SocksProxyAgent } from "socks-proxy-agent";
import { countryCodeEmoji } from "country-code-emoji";

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

  async test(account: V2Object, port: number = 10802, mode: "sni" | "cdn" | string = "cdn"): Promise<V2Object> {
    const config = JSON.parse(readFileSync("./config/v2ray/config.json").toString());

    if (mode == "cdn") {
      account.cdn = true;
      port = port + 1000;
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
        account.error = "No Internet!";
      }
    });

    await sleep(200);
    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      await fetch("https://api.myip.com/", {
        agent: new SocksProxyAgent(`socks5://127.0.0.1:${port}`),
        signal: controller.signal,
      }).then(async (res) => {
        const data = JSON.parse(await res.text());
        if (data.cc) {
          account.cc = data.cc;
        } else {
          account.cc = "XX";
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
    };
  }

  private async parse(accounts: Array<string> | string) {
    if (!Array.isArray(accounts)) accounts = [accounts];
    const ids: any = {};
    let port = 10800;

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

      await (async (account: V2Object) => {
        const isConnected: Array<V2Object> = [];
        const onTest: Array<string> = [];

        for (const mode of ["sni", "cdn"]) {
          let server = account.address;
          if (mode == "cdn") {
            if (!account.host) continue;
            server = account.host;
          }

          if (ids[server]) {
            if (ids[server].includes(account.id)) continue;
          }

          onTest.push(mode);
          this.test(account, port, mode)
            .then((res) => {
              if (res) isConnected.push(res);
            })
            .finally(() => {
              if (onTest[0]) onTest.shift();
            });
          // await sleep(500);
        }

        do {
          await sleep(100);
        } while (onTest[0]);

        for (let connectMode of isConnected) {
          if (!connectMode.error && connectMode.cc) {
            let server = connectMode.address;
            if (connectMode.cdn) server = connectMode.host;

            if (ids[server]) {
              if (!ids[server].includes(account.id)) ids[server].push(account.id);
            } else {
              ids[server] = [account.id];
            }

            if (!this.regions.includes(connectMode.cc)) this.regions.push(connectMode.cc);
            connectMode.remark = `${this.accounts.length + 1}  ⌜すごい⌟ ${connectMode.cdn ? "cdn" : "sni"} -> ${
              connectMode.cc != "XX" ? countryCodeEmoji(connectMode.cc) : "🇺🇳"
            }`;

            this.accounts.push(connectMode);
            console.log(`${connectMode.remark}: ${connectMode.cdn ? " CDN" : " SNI"} -> OK`);
          } else {
            console.log(`${connectMode.remark}: ${connectMode.cdn ? " CDN" : " SNI"} -> ${connectMode.error}`);
          }
        }
      })(v2Account);

      if (this.accounts.length > 50) break; // test purpose
    }
  }

  convert(bugs: Bugs, bugBundle: string): Array<string> {
    const countries: Array<Country> = JSON.parse(readFileSync("./countries.json").toString());
    const v2rayConfig = JSON.parse(readFileSync("./config/v2ray/config.json").toString());
    const clashProxies: Array<string> = ["proxies:"];
    const v2rayProxies: Array<Object> = [];
    const base64Proxies: Array<string> = [];
    let clashRegion = {
      Asia: [""],
      Europe: [""],
      Africa: [""],
      Oceania: [""],
      Americas: [""],
    };
    let clashCountry: Array<{
      region: string;
      proxy: string;
    }> = [];

    // Convert
    for (const account of this.accounts) {
      const cdn = bugs.cdn;
      const sni = bugs.sni;

      const clashProxy = this.toClash(account, sni, cdn);
      const v2rayProxy = this.toV2ray(account, sni, cdn, v2rayProxies.length + 1);
      const base64Proxy = this.toBase64(account, sni, cdn);

      if (clashProxy) {
        clashProxies.push(clashProxy);

        // Push to clash region
        for (const country of countries) {
          if (account.cc == "XX") break;
          if (country.code == account.cc) {
            clashRegion[country.region].push(clashProxy);
          }
        }

        // Push to clash country
        clashCountry.push({
          region: account.cc as string,
          proxy: clashProxy,
        });
      }
      if (v2rayProxy) v2rayProxies.push(v2rayProxy);
      if (base64Proxy) base64Proxies.push(base64Proxy);
    }

    // Split per region
    for (const region of Object.keys(clashRegion)) {
      const proxiesPerFile = ["proxies:"];
      clashRegion[region as Region].shift(); // Remove blank space
      proxiesPerFile.push(...clashRegion[region as Region]);

      writeFileSync(`./result/clash/providers-${bugBundle}-${region.toLowerCase()}.yaml`, proxiesPerFile.join("\n"));
    }

    // Split per country
    do {
      const proxiesPerFile = ["proxies:"];
      let currentCountry = "";
      for (let i = 0; i < clashCountry.length; i++) {
        if (!clashCountry[i]) continue;
        if (!currentCountry) currentCountry = clashCountry[i].region;

        if (clashCountry[i].region == currentCountry) {
          proxiesPerFile.push(clashCountry[i].proxy);
          delete clashCountry[i];
        }
      }

      writeFileSync(`./result/clash/providers-${bugBundle}-${currentCountry}.yaml`, proxiesPerFile.join("\n"));

      clashCountry = (() => {
        const filteredProxy = [];

        for (const proxy of clashCountry) {
          if (proxy) filteredProxy.push(proxy);
        }

        return filteredProxy;
      })();
    } while (clashCountry.length > 0);

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
