// Script temporário para converter SVG -> PNG
const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");

const svgPath = path.resolve(__dirname, "../src-tauri/icons/app-icon.svg");
const outPath = path.resolve(__dirname, "../src-tauri/icons/icon.png");

const svg = fs.readFileSync(svgPath, "utf8");

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
  background: "rgba(0,0,0,0)",
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

fs.writeFileSync(outPath, pngBuffer);
console.log(`✅ Icon gerado: ${outPath} (${pngBuffer.length} bytes)`);
