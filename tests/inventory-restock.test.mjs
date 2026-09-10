// Local demo emulator only. Setup matches tests/firestore-permissions.test.mjs.
// Run: node tests/inventory-restock.test.mjs (Firestore emulator on 127.0.0.1:8088).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const require = createRequire(new URL('../.tmp/testing/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, getDocs, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const root = process.cwd();
const mocks = {
  '@/lib/firebase': 'export let db; export const setDb = value => { db = value; };',
  '@/shared/services/currentUserIdentity': 'export const getCurrentUserIdentity = async () => fixture.identity;',
};
const bundle = await build({
  stdin: { contents: `export {inventoryService} from './src/modules/inventario/services/inventoryService'; export {setDb} from '@/lib/firebase';`, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'local-emulator', setup(b) {
    b.onResolve({filter: /^@\//}, args => {
      if (mocks[args.path]) return {path: args.path, namespace: 'fixture'};
      const base = path.join(root, 'src', args.path.slice(2));
      return {path: ['.ts', '.tsx', '/index.ts'].map(ext => base + ext).find(existsSync)};
    });
    b.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({contents: mocks[args.path], loader: 'js'}));
  }}],
});
const module = {exports: {}};
const errors = [];
const context = {};
new Function('module', 'exports', 'require', 'fixture', 'console', bundle.outputFiles[0].text)(
  module, module.exports, require, context, {...console, error: (...args) => errors.push(args)},
);
const {inventoryService, setDb} = module.exports;
const env = await initializeTestEnvironment({projectId: 'demo-claudent-restock', firestore: {host: '127.0.0.1', port: 8088, rules: readFileSync('firestore.rules', 'utf8')}});
let sequence = 0;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const fixture = async (permissions, count = 1, admin = false) => {
  const uid = `restock-${++sequence}`;
  const ids = Array.from({length: count}, (_, i) => `${uid}-product-${i}`);
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', uid), {status: 'active', roleIds: ['fixture'], permissions, isAdmin: admin});
    for (const id of ids) await setDoc(doc(db, 'inventarioProductos', id), {nombre: 'Material', categoria: 'clinico', unidad: 'pieza', estado: 'activo', stock: 5, stockMinimo: 1, costoUnitario: 10, proveedor: 'Anterior'});
  });
  const db = env.authenticatedContext(uid).firestore();
  setDb(db);
  context.identity = {usuarioId: uid, usuarioNombre: 'Fixture', usuarioEmail: 'fixture@example.test'};
  return {db, ids, uid, input: {fecha: '2026-09-09', proveedor: 'Nuevo proveedor', documentoCompra: `Factura-${uid}`, notas: '', items: ids.map(productoId => ({productoId, cantidad: 3, lote: 'Lote A', fechaVencimiento: ''}))}};
};
const verifyEntry = async ({db, ids}, id) => {
  const entry = (await getDoc(doc(db, 'inventarioEntradas', id))).data();
  assert.equal(entry.totalProductos, ids.length);
  assert.equal(entry.totalUnidades, ids.length * 3);
  assert.ok(entry.createdAt instanceof Timestamp);
  for (const productId of ids) {
    const product = (await getDoc(doc(db, 'inventarioProductos', productId))).data();
    assert.equal(product.stock, 8);
    assert.equal(product.proveedor, 'Nuevo proveedor');
    assert.equal(product.costoUnitario, 10);
  }
  const movements = (await getDocs(collection(db, 'inventarioMovimientos'))).docs.map(d => d.data()).filter(d => d.referenciaId === id);
  assert.equal(movements.length, ids.length);
  assert.ok(movements.every(m => m.tipo === 'entrada' && m.stockAnterior === 5 && m.stockNuevo === 8));
  assert.equal(errors.length, 0, 'Actual audit service must not log permission errors');
};
try {
  await env.clearFirestore();
  for (const grant of ['inventory.stock.adjust', 'inventory.purchaseList.manage']) {
    await test(`${grant}: transacción real y auditoría, con cambio de proveedor`, async () => {
      const f = await fixture(['inventory.view', grant], 2);
      await verifyEntry(f, await inventoryService.registerStockEntry(f.input));
    });
  }
  await test('Administrador conserva el reabastecimiento', async () => {
    const f = await fixture([], 1, true);
    await verifyEntry(f, await inventoryService.registerStockEntry(f.input));
  });
  for (const grants of [['inventory.view'], ['inventory.stock.adjust'], ['inventory.purchaseList.manage'], []]) {
    await test(`${grants.join(',') || 'sin permisos'}: operación denegada y atómica`, async () => {
      const f = await fixture(grants);
      await assertFails(inventoryService.registerStockEntry(f.input));
      await env.withSecurityRulesDisabled(async ctx => {
        assert.equal((await getDoc(doc(ctx.firestore(), 'inventarioProductos', f.ids[0]))).data().stock, 5);
        const entries = (await getDocs(collection(ctx.firestore(), 'inventarioEntradas'))).docs;
        assert.ok(!entries.some(d => d.data().documentoCompra === f.input.documentoCompra));
      });
      if (grants.length === 0) await assertFails(getDocs(collection(f.db, 'inventarioProductos')));
      if (grants.includes('inventory.view')) await getDocs(collection(f.db, 'inventarioProductos'));
    });
  }
  await test('Reabastecer no cambia catálogo, disminuye stock ni falsifica timestamps', async () => {
    const f = await fixture(['inventory.view', 'inventory.purchaseList.manage']);
    const ref = doc(f.db, 'inventarioProductos', f.ids[0]);
    for (const changes of [{costoUnitario: 0}, {nombre: 'Alterado'}, {estado: 'inactivo'}, {stock: -1}, {stock: 4}, {updatedAt: Timestamp.fromMillis(0)}]) {
      await assertFails(updateDoc(ref, {stock: 8, proveedor: 'Nuevo proveedor', updatedAt: serverTimestamp(), ...changes}));
    }
    const id = await inventoryService.registerStockEntry(f.input);
    await assertFails(updateDoc(doc(f.db, 'inventarioEntradas', id), {notas: 'Alterado'}));
  });
  await test('Movimiento de entrada requiere nueva entrada y actualización de producto', async () => {
    const f = await fixture(['inventory.view', 'inventory.stock.adjust']);
    const data = {productoId: f.ids[0], tipo: 'entrada', cantidad: 3, stockAnterior: 5, stockNuevo: 8, usuarioId: f.uid, referenciaTipo: 'entrada_stock', referenciaId: 'missing', proveedor: 'Nuevo proveedor', documentoCompra: 'F', lote: 'L', fecha: Timestamp.now(), createdAt: serverTimestamp()};
    await assertFails(setDoc(doc(collection(f.db, 'inventarioMovimientos')), data));
    const id = await inventoryService.registerStockEntry(f.input);
    await assertFails(setDoc(doc(collection(f.db, 'inventarioMovimientos')), {...data, referenciaId: id, stockAnterior: 8, stockNuevo: 11}));
  });
  await test('Creación de producto conserva su movimiento de stock inicial', async () => {
    const f = await fixture(['inventory.view', 'inventory.create']);
    const ref = doc(collection(f.db, 'inventarioProductos'));
    const batch = writeBatch(f.db);
    batch.set(ref, {nombre: 'Nuevo', categoria: 'clinico', unidad: 'pieza', estado: 'activo', stock: 3, stockMinimo: 1, costoUnitario: 10});
    batch.set(doc(collection(f.db, 'inventarioMovimientos')), {productoId: ref.id, tipo: 'entrada', cantidad: 3, stockAnterior: 0, stockNuevo: 3, usuarioId: f.uid, referenciaTipo: 'manual', referenciaId: ref.id});
    await batch.commit();
  });
  await test('Entrada de varios productos respeta el presupuesto de lecturas', async () => {
    const f = await fixture(['inventory.view', 'inventory.purchaseList.manage'], 20);
    await verifyEntry(f, await inventoryService.registerStockEntry(f.input));
  });
  console.log(`${passed} escenarios de reabastecimiento aprobados.`);
} finally {
  await env.cleanup();
}
