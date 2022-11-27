import { v2parse } from "./helper.mjs";
import { V2Object, Vless, Vmess } from "./types.mjs";
import fetch from "node-fetch";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { Bugs } from "./bugs.mjs";
import { V2Test } from "./v2test.mjs";

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

    process.stdout.write("Parsing... ");
    await this.parse(JSON.parse(await res.text()));
    process.stdout.write("done!.\n");

    process.stdout.write("Writing result...");
    writeFileSync(`${this.path}/result/result.json`, JSON.stringify(this.accounts, null, 2));
    process.stdout.write("done.!\n");
    console.log(`Result saved to ${this.path}/result/result.json`);
  }

  private async parse(accounts: Array<string> | string) {
    if (!Array.isArray(accounts)) accounts = [accounts];

    for (let account of accounts) {
      let accountObj: V2Object;

      const vpn = (account.match(/^(.+):\/\//) || [""])[1];
      if (account.startsWith("vmess://")) {
        const vmess = v2parse(account) as Vmess;

        process;
        accountObj = {
          vpn,
          cdn: vmess.cdn,
          address: vmess.add,
          port: vmess.port,
          host: vmess.host,
          alterId: vmess.aid,
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

        accountObj = {
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
        accountObj = {} as V2Object;
      }

      this.accounts.push(accountObj);
    }
  }

  async toClash(bug: string, sni: string, cdn: string) {
    if (!existsSync(`${this.path}/result/clash`)) mkdirSync(`${this.path}/result/clash`);
    const acceptedAccount = [];

    // Vmess
    for (let account of this.accounts) {
      let proxies = [];

      // Only support ws for now
      if (account.network != "ws") continue;
      if (!account.tls) account.cdn = true;
      account.remark = account.remark.replace("github.com/freefq - ", "");
      if (account.vpn == "vmess") {
        proxies.push(`  - name: '${account.remark}'`);
        proxies.push(`    type: ${account.vpn}`);
        proxies.push(`    port: ${account.port}`);
        proxies.push(`    uuid: ${account.id}`);
        proxies.push(`    alterId: ${account.alterId}`);
        proxies.push(`    cipher: auto`);
        proxies.push(`    tls: ${account.tls ? true : false}`);
        proxies.push(`    udp: true`);
        proxies.push(`    skip-cert-verify: ${account.skipCertVerify}`);
        proxies.push(`    network: ${account.network}`);
        proxies.push(`    ws-opts: `);
        proxies.push(`      path: ${account.path}`);
        proxies.push(`      headers:`);
        if (account.remark.match(/cloudflare/i) || account.cdn) {
          if (!account.host) continue;
          proxies.push(`        Host: ${account.host}`);
          proxies.push(`    servername: ${account.sni || account.host}`);
          proxies.push(`    server: ${cdn}`);
        } else {
          proxies.push(`        Host: ${sni}`);
          proxies.push(`    servername: ${sni}`);
          proxies.push(`    server: ${account.address}`);
        }
      } else if (account.vpn.startsWith("vless")) {
        proxies.push(`  - name: '${account.remark}'`);
        proxies.push(`    type: ${account.vpn}`);
        proxies.push(`    port: ${account.port}`);
        proxies.push(`    uuid: ${account.id}`);
        proxies.push(`    cipher: auto`);
        proxies.push(`    tls: ${account.tls ? true : false}`);
        proxies.push(`    udp: true`);
        proxies.push(`    skip-cert-verify: ${account.skipCertVerify}`);
        proxies.push(`    network: ${account.network}`);
        proxies.push(`    ws-opts: `);
        proxies.push(`      path: ${account.path}`);
        proxies.push(`      headers:`);
        if (account.remark.match(/cloudflare/i) || account.cdn) {
          if (!account.host) continue;
          proxies.push(`        Host: ${account.host}`);
          proxies.push(`    servername: ${account.sni || account.host}`);
          proxies.push(`    server: ${cdn}`);
        } else {
          proxies.push(`        Host: ${sni}`);
          proxies.push(`    servername: ${sni}`);
          proxies.push(`    server: ${account.address}`);
        }
      } else if (account.vpn.startsWith("trojan")) {
        proxies.push(`  - name: '${account.remark}'`);
        proxies.push(`    type: ${account.vpn.replace("-go", "")}`);
        proxies.push(`    port: ${account.port}`);
        proxies.push(`    password: ${account.id}`);
        proxies.push(`    udp: true`);
        proxies.push(`    skip-cert-verify: ${account.skipCertVerify}`);
        proxies.push(`    network: ${account.network}`);
        proxies.push(`    ws-opts: `);
        proxies.push(`      path: ${account.path}`);
        proxies.push(`      headers:`);
        if (account.remark.match(/cloudflare/i) || account.cdn) {
          if (!account.host) continue;
          proxies.push(`        Host: ${account.host}`);
          proxies.push(`    sni: ${account.sni || account.host}`);
          proxies.push(`    server: ${cdn}`);
        } else {
          proxies.push(`        Host: ${sni}`);
          proxies.push(`    sni: ${sni}`);
          proxies.push(`    server: ${account.address}`);
        }
      }

      acceptedAccount.push(proxies.join("\n"));
    }

    let providers = ["proxies:"];
    const proxiesPerProvider = Math.round(acceptedAccount.length / 6) || 1;

    let providersNumber = 1;
    for (const proxies of acceptedAccount) {
      if (!proxies) continue;
      providers.push(proxies);
      if (providers.length - 1 >= proxiesPerProvider && providersNumber <= 5) {
        writeFileSync(`${this.path}/result/clash/clash-${bug}-proxies-${providersNumber}.yaml`, providers.join("\n"));
        providers = ["proxies:"];
        providersNumber++;
      }
    }
    writeFileSync(`${this.path}/result/clash/clash-${bug}-proxies-${providersNumber}.yaml`, providers.join("\n"));
  }

  async toV2ray(bug: string, sni: string, cdn: string) {
    if (!existsSync(`${this.path}/result/v2ray`)) mkdirSync(`${this.path}/result/v2ray`);
    const base = JSON.parse(readFileSync("./config/base.json").toString());
    const acceptedAccount = [];

    // Vmess
    for (let i in this.accounts) {
      let account = this.accounts[i];
      let proxy: any = {};

      // Only support ws for now
      if (account.network != "ws") continue;
      if (!account.tls) account.cdn = true;
      account.remark = account.remark.replace("github.com/freefq - ", "");
      if (account.vpn == "vmess") {
        proxy = {
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
          tag: `proxy-${acceptedAccount.length + 1}`,
        };

        if (account.remark.match(/cloudflare/i) || account.cdn) {
          if (!account.host) continue;
          proxy.settings.vnext[0].address = cdn;
        } else {
          proxy.streamSettings.wsSettings.headers.Host = sni;
          proxy.streamSettings.tlsSettings.serverName = sni;
        }
      } else if (account.vpn.startsWith("vless")) {
      } else if (account.vpn.startsWith("trojan")) {
      }

      if (!proxy.mux) continue;

      const testConfig = base;
      testConfig.outbounds.push(proxy);
      writeFileSync(`${this.path}/config/test.json`, JSON.stringify(testConfig, null, 2));

      process.stdout.write(`${account.remark}: `);
      const isFine = await new V2Test().run();
      process.stdout.write(`${isFine ? "OK" : "Could not connect!"}\n`);
      testConfig.outbounds.pop();

      if (isFine) acceptedAccount.push(proxy);
      else this.accounts.splice(parseInt(i), 1);
      proxy = {};
    }

    base.outbounds.push(...acceptedAccount);
    writeFileSync(`${this.path}/result/v2ray/v2ray-${bug}.json`, JSON.stringify(base, null, 2));
  }
}

const v2scrape = new V2scrape();
export { v2scrape };
