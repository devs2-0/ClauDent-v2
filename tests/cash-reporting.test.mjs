// Run: node --test tests/cash-reporting.test.mjs. No database or production writes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
process.env.TZ = 'America/Mexico_City';
const bundle = await build({
  stdin: { contents: `export * from './src/modules/ventas/utils/cashFilters'; export * from './src/modules/ventas/utils/cashReporting'; export {safeLocalDate} from './src/shared/utils/firestoreData';`, resolveDir: process.cwd() },
  bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent',
});
const module = { exports: {} };
new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports);
const { isDateInRange, getDateRangeError, getPreviousRange, calculateVariation, formatVariation, safeLocalDate, buildCashSummary, buildClosureSummary, buildFinancialReportSnapshot, uniqueById, normalizeCashSearch } = module.exports;
const cash = (id, monto, extra = {}) => ({ id, monto, fecha: '2026-09-20', tipo: 'ingreso', metodo: 'efectivo', estado: 'activo', concepto: 'Cobro', referenciaTipo: 'pago', ...extra });
const sale = (id, extra = {}) => ({ id, productoId: id, productoNombre: 'Producto', fecha: '2026-09-20', tipo: 'venta', cantidad: -2, costoUnitario: 10, costoTotal: 20, ingresoTotal: 100, referenciaTipo: 'pago', referenciaId: 'p1', ...extra });
const report = (cashRows = [], sales = [], payments = []) => buildFinancialReportSnapshot(cashRows, sales, '2026-09-20', '2026-09-20', payments);

test('rangos inclusivos: hoy, extremos, fechas abiertas y rango inválido', () => {
  assert.equal(isDateInRange('2026-09-20', '2026-09-20', '2026-09-20'), true);
  for (const d of ['2026-09-19', '2026-09-21']) assert.equal(isDateInRange(d, '2026-09-20', '2026-09-20'), false);
  for (const d of ['2026-09-01', '2026-09-20']) assert.equal(isDateInRange(d, '2026-09-01', '2026-09-20'), true);
  assert.equal(isDateInRange('2020-01-01', '', ''), true);
  assert.equal(isDateInRange('2026-09-20', '', '2026-09-19'), false);
  assert.equal(isDateInRange('2026-09-20', '2026-09-21', ''), false);
  assert.equal(isDateInRange('2026-09-20', '2026-09-21', '2026-09-19'), false);
  assert.equal(isDateInRange('', '', ''), false);
});
test('no se intercambian silenciosamente fechas invertidas ni se aceptan fechas imposibles', () => {
  assert.ok(getDateRangeError({ start: '2026-09-21', end: '2026-09-20' }));
  assert.ok(getDateRangeError({ start: '', end: '' }, true));
  assert.ok(getDateRangeError({ start: '2026-02-30', end: '' }));
  assert.equal(getDateRangeError({ start: '2024-02-29', end: '' }), '');
});
test('comparación de igual duración al cruzar mes, año y año bisiesto', () => {
  assert.deepEqual(getPreviousRange('2026-01-01', '2026-01-01'), { start: '2025-12-31', end: '2025-12-31' });
  assert.deepEqual(getPreviousRange('2024-03-01', '2024-03-07'), { start: '2024-02-23', end: '2024-02-29' });
  assert.throws(() => getPreviousRange('', '2026-09-20'));
});
test('medianoche local: Date, Timestamp e ISO no se desplazan al día UTC', () => {
  const lastMinute = new Date('2026-09-21T05:59:59Z');
  assert.equal(safeLocalDate(lastMinute), '2026-09-20');
  assert.equal(safeLocalDate({ toDate: () => lastMinute }), '2026-09-20');
  assert.equal(safeLocalDate('2026-09-21T05:59:59Z'), '2026-09-20');
  assert.equal(safeLocalDate('2026-09-21T06:00:00Z'), '2026-09-21');
  assert.equal(safeLocalDate('2026-09-20'), '2026-09-20');
  assert.equal(safeLocalDate(null), '');
  assert.equal(safeLocalDate('invalido'), '');
});
test('porcentajes sin base y pérdidas anteriores se interpretan correctamente', () => {
  assert.equal(calculateVariation(100, 0), null);
  assert.equal(calculateVariation(-100, 0), null);
  assert.equal(calculateVariation(0, 0), 0);
  assert.equal(calculateVariation(0, 100), -100);
  assert.equal(calculateVariation(-50, -100), 50);
  assert.equal(formatVariation(null), 'Sin base de comparación');
});
test('no se repite un ID, pero se conservan distintos cortes del mismo día', () => {
  const rows = [{ id: 'a', fecha: '2026-09-20' }, { id: 'b', fecha: '2026-09-20' }, { id: 'a', fecha: '2026-09-20' }];
  assert.deepEqual(uniqueById(rows).map(r => r.id), ['a', 'b']);
  assert.equal(normalizeCashSearch('  José Álvarez  '), 'jose alvarez');
});
test('arqueo: apertura separada de ingresos, egresos por método y cancelados excluidos', () => {
  const result = buildCashSummary([
    cash('opening', 500, { referenciaTipo: 'apertura' }), cash('cash', 1000),
    cash('card', 700, { metodo: 'tarjeta' }), cash('transfer', 300, { metodo: 'transferencia' }),
    cash('expense', 100, { tipo: 'egreso' }), cash('bankExpense', 50, { tipo: 'egreso', metodo: 'transferencia' }),
    cash('cancelled', 9999, { estado: 'cancelado' }),
  ]);
  assert.equal(result.totalIngresos, 2000);
  assert.equal(result.fondoInicial, 500);
  assert.equal(result.totalEgresos, 150);
  assert.equal(result.balanceNeto, 1850);
  assert.equal(result.efectivoFinal, 1400);
  assert.deepEqual(result.desgloseMetodos.find(m => m.metodo === 'transferencia'), { metodo: 'transferencia', ingresos: 300, egresos: 50, neto: 250 });
});
test('un tratamiento de apertura no se confunde con fondo inicial', () => {
  assert.equal(buildCashSummary([cash('treatment', 100, { concepto: 'Apertura de conducto' })]).totalIngresos, 100);
  assert.equal(buildCashSummary([cash('old', 100, { referenciaTipo: 'manual', concepto: 'Apertura / Fondo de Caja' })]).fondoInicial, 100);
});
test('sumas financieras conservan centavos sin residuos binarios', () => {
  const rows = [cash('a', 0.1), cash('b', 0.2), cash('c', 0.1, { tipo: 'egreso' })];
  assert.equal(buildCashSummary(rows).totalIngresos, 0.3);
  assert.equal(buildCashSummary(rows).efectivoFinal, 0.2);
  assert.equal(report(rows).ingresos, 0.3);
  assert.equal(report(rows).utilidadNeta, 0.2);
});
test('el detalle cerrado conserva los totales auditados', () => {
  const closure = { estado: 'cerrado', totales: { efectivo: 200, tarjeta: 0, transferencia: 0, total: 200 }, fondoInicial: 100, totalEgresos: 30, balanceNeto: 170, efectivoEsperado: 270 };
  const result = buildClosureSummary(closure, []);
  assert.equal(result.totalIngresos, 200);
  assert.equal(result.efectivoFinal, 270);
  assert.equal(result.fondoInicial, 100);
});
test('reporte excluye cancelaciones, aperturas y movimientos fuera de rango', () => {
  const result = report([cash('ok', 100), cash('bad', 900, { estado: 'cancelado' }), cash('open', 1000, { referenciaTipo: 'apertura' }), cash('yesterday', 50, { fecha: '2026-09-19' }), cash('expense', 30, { tipo: 'egreso', categoriaGasto: 'servicios' })], [sale('cancelled', { referenciaId: 'cancelled' }), sale('active')], [{ id: 'cancelled', estado: 'cancelado' }]);
  assert.equal(result.ingresos, 100);
  assert.equal(result.gastosOperativos, 30);
  assert.equal(result.costoMercaderia, 20);
  assert.equal(result.utilidadNeta, 50);
  assert.equal(result.ventasPorProducto.length, 1);
  assert.equal(result.gastosPorCategoria[0].categoria, 'Servicios');
});
test('descuento proporcional en venta mixta y productos homónimos permanecen separados', () => {
  const result = report([], [sale('a'), sale('b'), sale('c', { productoId: 'a', productoNombre: 'Nombre cambiado' })], [{ id: 'p1', estado: 'activo', subtotalServicios: 500, subtotalProductos: 500, descuento: 100 }]);
  assert.equal(result.ventasPorProducto.length, 2);
  assert.equal(result.ventasPorProducto.find(p => p.productoId === 'a').ingreso, 180);
  assert.equal(result.ventasPorProducto.find(p => p.productoId === 'b').ingreso, 90);
});
test('ceros guardados son válidos; importes históricos ausentes usan cantidad por precio', () => {
  const result = report([], [sale('free', { ingresoTotal: 0, costoTotal: 0, precioUnitarioVenta: 50 }), sale('old', { ingresoTotal: undefined, costoTotal: undefined, precioUnitarioVenta: 40 })]);
  assert.equal(result.ventasPorProducto.find(p => p.productoId === 'free').ingreso, 0);
  assert.equal(result.ventasPorProducto.find(p => p.productoId === 'free').costo, 0);
  assert.equal(result.ventasPorProducto.find(p => p.productoId === 'old').ingreso, 80);
  assert.equal(result.costoMercaderia, 20);
});
