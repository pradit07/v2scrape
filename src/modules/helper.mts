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
      path: (account.match(/path=((\/|%2F)\w+)/) || [""])[1],
      host: (account.match(/host=([\w\-_\.]+)/) || [""])[1],
      remark: (account.match(/#(.+)/) || [""])[1],
      sni: (account.match(/sni=([\w\-_\.]+)/) || [""])[1],
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

async function isCdn(server: string, host: string): Promise<boolean> {
  if (!(server && host)) return false;
  const isCdn: Array<boolean> = [];
  const onFetch: Array<string> = [];

  for (const url of [server, host]) {
    onFetch.push(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

    await fetch(`https://${url}`, {
      signal: controller.signal,
    })
      .then((res) => {
        isCdn.push(res.headers.get("server") == "cloudflare");
      })
      .catch((e) => {
        // Ignore error
      })
      .finally(() => {
        clearTimeout(timeout);
        if (onFetch[0]) onFetch.shift();
      });
  }

  do {
    sleep(100);
  } while (onFetch[0]);

  if (isCdn[0] && isCdn[1]) return true;
  else return false;
}

export { v2parse, isCdn, sleep };
