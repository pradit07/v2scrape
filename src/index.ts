import { v2scrape } from "./modules/v2scrape.mjs";
import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { Bugs } from "./modules/bugs.mjs";

rmSync("./result/", {
  force: true,
  recursive: true,
});
if (!existsSync("./result")) mkdirSync("./result");

const bugBundleList = readdirSync(`${v2scrape.path}/bugs`);

(async () => {
  await v2scrape.get();

  for (const bugBundle of bugBundleList) {
    const bug = bugBundle.replace(".json", "");
    const bugs = new Bugs(bug);
    const [sni, cdn] = [bugs.sni, bugs.cdn];

    await v2scrape.toV2ray(bug, sni, cdn);
    await v2scrape.toClash(bug, sni, cdn);
  }
})();
