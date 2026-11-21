// @ts-check
/**
 * Install the lefthook pre-commit hook. If git already points core.hooksPath
 * somewhere else, install into that directory instead of failing.
 */
import { spawnSync } from "node:child_process";

const configured = spawnSync("git", ["config", "--get", "core.hooksPath"], {
  encoding: "utf8",
});
const args =
  configured.stdout && configured.stdout.trim()
    ? ["install", "--force"]
    : ["install"];
const result = spawnSync("lefthook", args, { stdio: "inherit" });
process.exit(result.status ?? 1);
