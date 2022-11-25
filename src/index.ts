import { converter } from "./modules/converter.mjs";
import { existsSync, mkdirSync } from "fs";

if (!existsSync("./result")) mkdirSync("./result");

(async () => {
  await converter.get();
  converter.toClash();
})();
