// src-tauri/scripts/gen-tray-icons.mjs
// Gera PNGs 32x32 para os ícones de estado da bandeja a partir dos SVGs.
// Uso: node src-tauri/scripts/gen-tray-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir  = resolve(__dirname, "../icons");

const ICONS = ["tray-normal", "tray-error", "tray-paused", "tray-printing"];

for (const name of ICONS) {
  const svg = readFileSync(resolve(iconsDir, `${name}.svg`));
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 32 } });
  const png = resvg.render().asPng();
  writeFileSync(resolve(iconsDir, `${name}.png`), png);
  console.log(`✓ ${name}.png gerado`);
}
