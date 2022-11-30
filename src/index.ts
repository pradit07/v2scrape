import { v2scrape } from "./modules/v2scrape.mjs";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { Bugs } from "./modules/bugs.mjs";
import { bot } from "./modules/tg.mjs";

rmSync("./result/", {
  force: true,
  recursive: true,
});
if (!existsSync("./result")) mkdirSync("./result");

const bugBundleList = readdirSync(`${v2scrape.path}/bugs`);

(async () => {
  await v2scrape.get();
  let base64Proxies: Array<string> = [];

  for (const bugBundle of bugBundleList) {
    const bug = bugBundle.replace(".json", "");
    const bugs = new Bugs(bug);

    base64Proxies.push(...v2scrape.convert(bugs, bug));
  }

  // Write entire result in base64 encoded
  writeFileSync("./result/base64", Buffer.from(base64Proxies.join("\n")).toString("base64"));

  // Send sample result to telegram channel
  await bot.send();
})();
