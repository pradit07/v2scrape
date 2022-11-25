import { converter } from "./modules/converter.mjs";

(async () => {
  await converter.get();
  converter.toClash();
})();
