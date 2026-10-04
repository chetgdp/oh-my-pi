#!/usr/bin/env bun
// Regenerates src/styles/fonts/IosevkaTerm-{Regular,Bold}.woff2 from an official
// Iosevka release. Needs `gh` and `nix`; fonttools runs in a throwaway nix shell.
// Usage: bun scripts/subset-font.ts [version]
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { $ } from "bun";

const version = process.argv[2] ?? "34.9.0";
// Default layout features only: keeping all features ("*") pulls in every
// stylistic-set variant and grows each file from ~18KB to ~138KB.
const unicodes = [
	"U+0020-007E",
	"U+00A0-00FF",
	"U+2010-2027",
	"U+2190-2199",
	"U+21B5",
	"U+2500-257F",
	"U+25A0-25CF",
	"U+2713",
	"U+2717",
].join(",");

const outDir = path.resolve(import.meta.dir, "../src/styles/fonts");
const work = await fs.mkdtemp(path.join(os.tmpdir(), "iosevka-"));
const asset = `PkgWebFont-Unhinted-IosevkaTerm-${version}.zip`;
const pyEnv = "with import <nixpkgs> {}; python3.withPackages (p: [p.fonttools p.brotli])";

try {
	await $`gh release download v${version} -R be5invis/Iosevka -p ${asset} -D ${work}`;
	await $`unzip -q ${path.join(work, asset)} -d ${work}`;
	for (const weight of ["Regular", "Bold"]) {
		const input = path.join(work, "WOFF2-Unhinted", `IosevkaTerm-${weight}.woff2`);
		const output = path.join(outDir, `IosevkaTerm-${weight}.woff2`);
		await $`nix shell --impure --expr ${pyEnv} -c python3 -m fontTools.subset ${input} --flavor=woff2 --unicodes=${unicodes} --output-file=${output}`;
		console.log(`${output}: ${Bun.file(output).size} bytes`);
	}
} finally {
	await fs.rm(work, { recursive: true, force: true });
}
