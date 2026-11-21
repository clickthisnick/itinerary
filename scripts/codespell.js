// @ts-check
/**
 * codespell is the Python spelling tool. The npm package of the same name is unrelated.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const target = "node_modules/.cache/codespell";
const binary = join(target, "bin/codespell");

if (!existsSync(binary)) {
  const install = spawnSync(
    "python3",
    ["-m", "pip", "install", "--target", target, "-r", "requirements-dev.txt"],
    { stdio: "inherit" },
  );
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
}

const result = spawnSync(
  "python3",
  [
    binary,
    "--skip=.git,node_modules,.venv,package-lock.json",
    // The prompt id is the historical spelling. Renaming it is not required for behavior.
    "-L",
    "promt",
    ".",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PYTHONPATH: target },
  },
);
process.exit(result.status ?? 1);
