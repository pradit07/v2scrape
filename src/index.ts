import { v2scrape } from "./modules/v2scrape.mjs";
import { existsSync, mkdirSync, readdirSync } from "fs";

if (!existsSync("./result")) mkdirSync("./result");

const bugBundleList = readdirSync(`${v2scrape.path}/bugs`);

(async () => {
  await v2scrape.get();

  for (const bugBundle of bugBundleList) {
    v2scrape.toClash(bugBundle.replace(".json", ""));
  }
})();
