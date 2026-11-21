// @ts-check
import { readFileSync, statSync } from "node:fs";

/** Files the pages load. README and tooling are not part of this budget. */
const shipped = [
  "index.html",
  "itinerary.html",
  "itinerary.js",
  "assets/ceruleanBootswatch.min.css",
];

const total = shipped.reduce((sum, path) => sum + statSync(path).size, 0);
const budget = JSON.parse(readFileSync("size-budget.json", "utf8"));
const maxBytes = budget.maxBytes;

for (const path of shipped) {
  console.log(`${statSync(path).size}\t${path}`);
}
console.log(`${total}\tshipped total`);

if (typeof maxBytes !== "number") {
  console.error("size-budget.json needs a numeric maxBytes");
  process.exit(1);
}

if (total > maxBytes) {
  console.error(`shipped assets are ${total} bytes, budget is ${maxBytes}`);
  process.exit(1);
}
