import { isCdn as checkIsCdn, v2parse } from "./helper.mjs";
import { V2Object, Vless, Vmess } from "./types.mjs";
import fetch from "node-fetch";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { Bugs } from "./bugs.mjs";

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
      let isCdn: boolean = false;

      const vpn = (account.match(/^(.+):\/\//) || [""])[1];
      if (account.startsWith("vmess://")) {
        const vmess = v2parse(account) as Vmess;

        // isCdn = await checkIsCdn(vmess.add, vmess.host);

        process;
        accountObj = {
          vpn,
          isCdn,
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

        // isCdn = await checkIsCdn(vless.server, vless.host);

        accountObj = {
          vpn,
          isCdn,
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

  toClash(bugBundle: string) {
    if (!existsSync(`${this.path}/result/clash`)) mkdirSync(`${this.path}/result/clash`);
    const bugs = new Bugs(bugBundle);
    const acceptedAccount = [];

    // Vmess
    for (const account of this.accounts) {
      const cdn = bugs.cdn;
      const sni = bugs.sni;
      let accept = false;
      let proxies = [];

      // Only support ws for now
      if (account.network != "ws") continue;
      if (!account.tls) continue;
      if (account.vpn == "vmess") {
        accept = true;
        proxies.push(`  - name: '${account.remark.replace("github.com/freefq - ", "")}'`);
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
        if (account.remark.match(/cloudflare/i) || account.isCdn) {
          proxies.push(`        Host: ${account.host}`);
          proxies.push(`    servername: ${account.sni || account.host}`);
          proxies.push(`    server: ${cdn}`);
        } else {
          proxies.push(`        Host: ${sni}`);
          proxies.push(`    servername: ${sni}`);
          proxies.push(`    server: ${account.address}`);
        }
      }

      // Need some work for trojan and other

      acceptedAccount.push(proxies.join("\n"));
    }

    let providers = ["proxies:"];
    const proxiesPerProvider = Math.round(acceptedAccount.length / 6) || 1;

    let providersNumber = 1;
    for (const proxies of acceptedAccount) {
      if (!proxies) continue;
      providers.push(proxies);
      if (providers.length >= proxiesPerProvider && providersNumber <= 5) {
        writeFileSync(
          `${this.path}/result/clash/clash-${bugBundle}-proxies-${providersNumber}.yaml`,
          providers.join("\n")
        );
        providers = ["proxies:"];
        providersNumber++;
      }
    }
    writeFileSync(`${this.path}/result/clash/clash-${bugBundle}-proxies-${providersNumber}.yaml`, providers.join("\n"));
  }
}

const v2scrape = new V2scrape();
export { v2scrape };
