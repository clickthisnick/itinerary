// @ts-check
/**
 * Official actionlint release. The npm package named actionlint is a separate wasm build.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const version = "1.7.12";
const cacheDir = "node_modules/.cache";
const binary = join(cacheDir, `actionlint-${version}`);

const platform = process.platform === "darwin" ? "darwin" : "linux";
const arch = process.arch === "arm64" ? "arm64" : "amd64";

async function ensureBinary() {
  if (existsSync(binary)) {
    return;
  }
  mkdirSync(cacheDir, { recursive: true });
  const name = `actionlint_${version}_${platform}_${arch}.tar.gz`;
  const url = `https://github.com/rhysd/actionlint/releases/download/v${version}/${name}`;
  const archive = join(tmpdir(), name);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `could not download actionlint ${version}: ${response.status}`,
    );
  }
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  const extracted = spawnSync(
    "tar",
    ["-xzf", archive, "-C", cacheDir, "actionlint"],
    {
      stdio: "inherit",
    },
  );
  if (extracted.status !== 0) {
    process.exit(extracted.status ?? 1);
  }
  spawnSync("mv", [join(cacheDir, "actionlint"), binary], { stdio: "inherit" });
  chmodSync(binary, 0o755);
}

await ensureBinary();
const result = spawnSync(binary, [], { stdio: "inherit" });
process.exit(result.status ?? 1);
