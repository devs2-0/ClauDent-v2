import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: "export { calculatePercentageDiscount, normalizeDiscountPercentage, roundCurrency } from './src/modules/ventas/utils/discounts';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
  logLevel: "silent",
});

const module = { exports: {} };
new Function("module", "exports", bundle.outputFiles[0].text)(module, module.exports);

const { calculatePercentageDiscount, normalizeDiscountPercentage, roundCurrency } = module.exports;

assert.equal(calculatePercentageDiscount(1000, 90), 900, "90 debe descontar el 90% de $1,000");
assert.equal(calculatePercentageDiscount(1234.56, 12.5), 154.32, "el descuento porcentual conserva centavos");
assert.equal(calculatePercentageDiscount(99.99, 12.5), 12.5, "el importe se redondea a centavos");
assert.equal(normalizeDiscountPercentage(-5), 0, "el porcentaje no puede ser negativo");
assert.equal(normalizeDiscountPercentage("invalido"), 0, "un porcentaje invalido se trata como cero");
assert.equal(roundCurrency(19.999), 20, "los importes se redondean a centavos");

console.log("PASS descuentos de ventas directas por porcentaje");
