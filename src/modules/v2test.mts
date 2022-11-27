import { spawn } from "child_process";
import { SocksProxyAgent } from "socks-proxy-agent";
import fetch from "node-fetch";
import { sleep } from "./helper.mjs";

class V2Test {
  async run() {
    const v2ray = spawn("v2ray", ["run", "-c", "./config/test.json"]);
    let isConnected: boolean = true;

    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 4000);

    v2ray.stdout.on("data", (res: any) => {
      // console.log(res.toString());
      if (res.toString().match(/(context deadline exceeded|timeout|write on closed pipe)/i)) {
        isConnected = false;
      }
    });

    await sleep(1000);
    try {
      await fetch("https://google.com", {
        agent: new SocksProxyAgent("socks://127.0.0.1:10802"),
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
    return isConnected;
  }
}

export { V2Test };
