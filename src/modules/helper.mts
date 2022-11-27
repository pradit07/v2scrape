import { Vless, Vmess } from "./types.mjs";

// AbortController was added in node v14.17.0 globally
const AbortController = globalThis.AbortController;

function v2parse(account: string): Vmess | Vless {
  if (account.startsWith("vmess")) {
    return JSON.parse(Buffer.from(account.replace("vmess://", ""), "base64").toString()) as Vmess;
  } else if (account.match(/^(vless|trojan)/)) {
    return {
      server: (account.match(/@(.+):/) || [""])[1],
      port: parseInt((account.match(/:(\d+)/) || ["0"])[1]),
      id: (account.match(/:\/\/(.+)@/) || "")[1],
      security: (account.match(/security=(\w+)/) || [""])[1],
      encryption: (account.match(/encryption=(\w+)/) || ["none"])[1],
      headerType: (account.match(/headerType=(\w+)/) || ["none"])[1],
      type: (account.match(/type=(\w+)/) || [""])[1],
      path: (account.replace(/%2F/, "/").match(/path=((\/|\w)+)/) || ["/"])[1],
      host: (account.match(/host=([\w\-_\.]+)/) || [""])[1],
      remark: (account.match(/#(.+)/) || [""])[1],
      sni: (account.match(/sni=([\w\-_\.]+)/) || [""])[1],
      cdn: account.match(/cdn=(true)/) ? true : false,
    } as Vless;
  } else {
    return {} as Vmess;
  }
}

async function sleep(ms: number) {
  return await new Promise((resolve) => {
    setTimeout(() => {
      resolve(0);
    }, ms);
  });
}

export { v2parse, sleep };
