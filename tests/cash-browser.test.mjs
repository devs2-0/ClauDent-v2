// Real CajaPage in Chromium, with isolated in-memory services. No Firebase access.
// Setup: npm install --prefix .tmp/caja-audit --no-save --package-lock=false playwright
// Run after npm run build: node tests/cash-browser.test.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
process.env.TZ = 'America/Mexico_City';
const require = createRequire(new URL('../.tmp/caja-audit/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = process.cwd();
const output = path.join(root, '.tmp/caja-audit');
mkdirSync(output, { recursive: true });
const fixture = `
  import { today, addDays } from '@/modules/ventas/utils/cashFilters';
  import { buildCashSummary } from '@/modules/ventas/utils/cashReporting';
  import { defaultCashShiftSettings } from '@/modules/ventas/services/cashShiftSettingsService';
  const date = today();
  const items = Array.from({length:31}, (_,i) => ({productoId:'product-'+i,nombre:'Producto '+i,cantidad:1,precioUnitario:100}));
  export const payments = Array.from({length:36}, (_,i) => ({
    id:'payment-'+String(i+1).padStart(3,'0'), corteId:'cut-today', pacienteNombre:i===0?'José Álvarez':'Paciente '+i, concepto:i===0?'Venta con muchos productos':'Consulta '+i,
    fecha:date, metodo:i%3===0?'efectivo':i%3===1?'tarjeta':'transferencia', monto:i===0?2790:100,
    origen:'venta_directa', estado:i===35?'cancelado':'activo', productos:i===0?items:[], totalVenta:i===0?2790:100,
    subtotalProductos:i===0?3100:0, subtotalServicios:i===0?0:100, descuento:i===0?310:0, descuentoPorcentaje:i===0?10:0,
    saldoPendiente:0, notas:'Observación de prueba. '.repeat(12),
  }));
  payments.push({ ...payments[1], id:'previous-payment',fecha:addDays(date,-1),corteId:'cut-1',pacienteNombre:'Pago anterior' });
  export const movements = payments.map(p=>({id:'movement-'+p.id, corteId:p.corteId, fecha:p.fecha, tipo:'ingreso', metodo:p.metodo, concepto:p.concepto, monto:p.monto, referenciaTipo:'pago', referenciaId:p.id, estado:p.estado, usuarioNombre:'Operador de pruebas'}));
  movements.push({id:'opening',corteId:'cut-today',fecha:date,tipo:'ingreso',metodo:'efectivo',concepto:'Apertura / Fondo de Caja',monto:500,referenciaTipo:'apertura',estado:'activo'});
  for (const [i,cat] of ['suministros','servicios','renta','nomina','mantenimiento','otros',null].entries()) movements.push({id:'expense-'+i,corteId:'cut-today',fecha:date,tipo:'egreso',metodo:'efectivo',concepto:'Gasto '+i,monto:10*(i+1),categoriaGasto:cat,referenciaTipo:'manual',estado:'activo'});
  export const cuts = [{id:'cut-today',fecha:date},{id:'cut-morning',fecha:date},...Array.from({length:35},(_,i)=>({id:'cut-'+(i+1),fecha:addDays(date,-(i+1))}))].map(c=>{
    const sum=buildCashSummary(movements.filter(m=>m.corteId===c.id));
    return {...c,inicio:c.fecha,fin:c.fecha,estado:'cerrado',tipoCierre:'manual',turnoNombre:'Turno '+c.id,usuarioAperturaNombre:'José Álvarez',usuarioCierreNombre:'Ana',observaciones:'Observaciones del corte. '.repeat(20),totales:sum.totales,totalEgresos:sum.totalEgresos,balanceNeto:sum.balanceNeto,fondoInicial:sum.fondoInicial,efectivoEsperado:sum.efectivoFinal,efectivoContado:sum.efectivoFinal-5,diferenciaEfectivo:-5};
  });
  cuts.push({...cuts[0]});
  export const inventoryMovements = items.map((item,i)=>({id:'inventory-'+i,productoId:item.productoId,productoNombre:item.nombre,fecha:date,tipo:'venta',cantidad:-1,costoTotal:20,costoUnitario:20,ingresoTotal:100,referenciaTipo:'pago',referenciaId:payments[0].id}));
  inventoryMovements.push({...inventoryMovements[0],id:'cancelled-inventory',productoId:'cancelled-product',referenciaId:'payment-036'});
  export const accounts = Array.from({length:15},(_,i)=>({id:'account-'+i,pacienteId:'patient-'+i,pacienteNombre:'Paciente pendiente '+i,concepto:'Tratamiento pendiente',fechaCreacion:addDays(date,-30),totalAbonado:100,saldoPendiente:500,estado:'pendiente'}));
  const fail = () => { globalThis.__cashWrites=(globalThis.__cashWrites||0)+1;throw new Error('This test must never write financial data'); };
  export const cash = {payments,cashClosures:cuts,cashMovements:movements,paymentsLoading:false,cashClosuresLoading:false,cashMovementsLoading:false,cashShiftSettingsLoading:false,cashShiftSettings:{...defaultCashShiftSettings,permitirMultiplesCortesPorDia:true},openCashRegister:fail,cancelPayment:fail,closeCashRegister:fail,autoCloseCashRegister:fail,updateCashShiftSettings:fail};
`;
const mocks = {
  'cash-fixture': fixture,
  '@/auth': `export const useCan = () => ({ can: p => !location.search.includes('readonly') || !['sales.cancel','sales.cashShift.close','settings.update'].includes(p) });`,
  '../hooks/useCashRegister': `import {cash} from 'cash-fixture';import {addDays,today} from '@/modules/ventas/utils/cashFilters';const overdueCuts=[{...cash.cashClosures[0],fecha:addDays(today(),-1),estado:'abierto'},...cash.cashClosures.slice(1).filter(c=>c.id!==cash.cashClosures[0].id)];export const useCashRegister=()=>({...cash, cashClosures:location.search.includes('overdue')?overdueCuts:cash.cashClosures,paymentsUnavailable:location.search.includes('unavailable'),cashSummaryUnavailable:location.search.includes('unavailable')});`,
  '@/modules/inventario': `import {inventoryMovements} from 'cash-fixture';export const useInventory=()=>({movements:inventoryMovements,movementsLoading:false,movementsUnavailable:location.search.includes('inventory-error')});`,
  '../services/accountsReceivableService': `import {accounts} from 'cash-fixture';export const accountsReceivableService={listenAllAccounts(cb,onError){if(location.search.includes('accounts-error'))onError();else cb(accounts);return ()=>{};}};`,
  '@/lib/firebase': `export const db={};export const auth={};`,
};
const result = await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {TooltipProvider} from '@/shared/components/ui/tooltip';import Cash from './src/modules/ventas/pages/CajaPage';createRoot(document.getElementById('root')).render(<TooltipProvider><div style={{display:'flex',minHeight:'100vh'}}><aside className="hidden lg:block" style={{width:256,flexShrink:0,borderRight:'1px solid #ddd',padding:24}}>ClauDent<br/><br/>Caja</aside><main style={{flex:1,minWidth:0,padding:16}}><Cash/></main></div></TooltipProvider>);`, loader: 'tsx', resolveDir: root },
  jsx: 'automatic', bundle: true, format: 'esm', write: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'isolated-services', setup(b) {
    b.onResolve({filter:/.*/}, args => {
      if (mocks[args.path]) return {path:args.path,namespace:'fixture'};
      if (args.path.startsWith('@/')) {
        const base=path.join(root,'src',args.path.slice(2));
        return {path:['.ts','.tsx','/index.ts','/index.tsx',''].map(ext=>base+ext).find(existsSync)};
      }
    });
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));
  }}],
});
const cssFile = readdirSync(path.join(root,'dist/assets')).find(f=>f.endsWith('.css'));
assert.ok(cssFile, 'Run npm run build first');
const css = readFileSync(path.join(root,'dist/assets',cssFile));
const server = createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(result.outputFiles[0].text);}
  if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const options = {headless:true};
const cachedChrome = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
if(existsSync(cachedChrome)) options.executablePath=cachedChrome;
const browser=await chromium.launch(options);
const context=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'America/Mexico_City'});
const page=await context.newPage();
page.setDefaultTimeout(5000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
const panel=()=>page.getByRole('tabpanel');
const dateString=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const assertNoOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page must not overflow horizontally');
const assertDialogBounds=async()=>{
  const geometry=await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:innerHeight,width:innerWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflow:getComputedStyle(el).overflowY,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};});
  assert.ok(geometry.top>=0&&geometry.bottom<=geometry.height+1,JSON.stringify(geometry));
  assert.ok(geometry.left>=0&&geometry.right<=geometry.width+1,JSON.stringify(geometry));
  assert.equal(geometry.overflow,'auto');
  assert.ok(geometry.scrollWidth<=geometry.clientWidth+1,JSON.stringify(geometry));
};
try {
  await page.goto(base);
  await page.getByRole('heading',{name:'Caja',exact:true}).waitFor();
  await check('pagos: solo hoy, diez filas, siguiente página y resumen de hoy independiente',async()=>{
    assert.equal(await panel().locator('tbody tr').count(),10);
    assert.match(await panel().innerText(),/1-10 de 36 pagos/);
    await panel().getByRole('button',{name:'Pagina siguiente'}).click();
    assert.match(await panel().innerText(),/11-20 de 36 pagos/);
    await assertNoOverflow();
  });
  await check('búsqueda por nombre sin acentos reinicia paginación; método y estado combinables',async()=>{
    await panel().getByPlaceholder('Buscar pago...').fill('jose alvarez');
    assert.equal(await panel().locator('tbody tr').count(),1);
    assert.match(await panel().innerText(),/José Álvarez/);
    await panel().getByRole('button',{name:'Limpiar búsqueda'}).click();
    await panel().getByRole('combobox',{name:'Método de pago'}).click();
    await page.getByRole('option',{name:'Tarjeta',exact:true}).click();
    assert.match(await panel().innerText(),/1-10 de 12 pagos/);
    await panel().getByRole('button',{name:'Limpiar búsqueda'}).click();
    await panel().getByRole('combobox',{name:'Estado del pago'}).click();
    await page.getByRole('option',{name:'Cancelados',exact:true}).click();
    assert.match(await panel().innerText(),/1-1 de 1 pagos/);
    assert.match(await panel().innerText(),/Cobros activos del filtro: \$0\.00/);
    await panel().getByRole('button',{name:'Limpiar búsqueda'}).click();
  });
  await check('fechas pendientes no filtran hasta Buscar; hoy excluye ayer; limpiar recupera todas',async()=>{
    await panel().getByLabel('Desde',{exact:true}).fill(dateString(-1));
    assert.match(await panel().innerText(),/Fechas sin aplicar/);
    assert.match(await panel().innerText(),/de 36 pagos/);
    await panel().getByRole('button',{name:'Buscar',exact:true}).click();
    assert.match(await panel().innerText(),/de 37 pagos/);
    await panel().getByRole('button',{name:'Hoy',exact:true}).click();
    assert.match(await panel().innerText(),/de 36 pagos/);
    await panel().getByRole('button',{name:'Quitar filtro de fechas'}).click();
    assert.match(await panel().innerText(),/Todas las fechas/);
    assert.match(await panel().innerText(),/de 37 pagos/);
    await panel().getByRole('button',{name:'Hoy',exact:true}).click();
  });
  await check('pendientes tiene búsqueda independiente de pagos y saldo del listado',async()=>{
    await panel().getByPlaceholder('Buscar pago...').fill('jose');
    await page.getByRole('tab',{name:'Pendientes',exact:true}).click();
    assert.match(await panel().innerText(),/1-10 de 15 pendientes/);
    assert.equal(await panel().getByPlaceholder('Buscar pendiente...').inputValue(),'');
    await panel().getByPlaceholder('Buscar pendiente...').fill('no existe');
    assert.match(await panel().innerText(),/No hay cuentas pendientes/);
    await panel().getByRole('button',{name:'Limpiar búsqueda'}).click();
    await page.getByRole('tab',{name:'Pagos',exact:true}).click();
    assert.equal(await panel().getByPlaceholder('Buscar pago...').inputValue(),'jose');
    await panel().getByRole('button',{name:'Limpiar búsqueda'}).click();
  });
  for(const size of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:600},{width:375,height:667}]) {
    await check('detalle de pago con 31 productos, scroll y salida '+size.width+'x'+size.height,async()=>{
      await page.setViewportSize(size);
      await panel().getByRole('button',{name:'Ver detalle de venta'}).first().click();
      await assertDialogBounds();
      assert.match(await page.getByRole('dialog').innerText(),/1-10 de 31 conceptos/);
      await page.getByRole('dialog').getByRole('button',{name:'Pagina siguiente'}).click();
      assert.match(await page.getByRole('dialog').innerText(),/11-20 de 31 conceptos/);
      await page.getByRole('dialog').getByRole('button',{name:'Cerrar detalle',exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,'pago-'+size.width+'.png')});
      await page.getByRole('dialog').getByRole('button',{name:'Cerrar detalle',exact:true}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
      await assertNoOverflow();
    });
  }
  await page.setViewportSize({width:1366,height:768});
  await page.getByRole('tab',{name:'Corte',exact:true}).click();
  await check('cortes: hoy conserva dos turnos distintos sin duplicar el mismo ID',async()=>{
    await panel().getByRole('button',{name:'Hoy',exact:true}).click();
    assert.equal(await panel().locator('tbody tr').count(),2);
    assert.match(await panel().innerText(),/2 cortes encontrados/);
    assert.equal(await panel().getByRole('button',{name:'Exportar CSV'}).isDisabled(),true);
    await panel().getByRole('button',{name:'Quitar filtro de fechas'}).click();
    assert.match(await panel().innerText(),/1-10 de 37 cortes/);
    await panel().getByRole('button',{name:'Pagina siguiente'}).click();
    assert.match(await panel().innerText(),/11-20 de 37 cortes/);
    await panel().getByRole('button',{name:'Hoy',exact:true}).click();
    assert.match(await panel().innerText(),/1-2 de 2 cortes/);
  });
  await check('corte ya seleccionado abre su detalle con el ojo; Escape y botón cierran',async()=>{
    await panel().locator('tbody tr').first().click();
    await panel().getByRole('button',{name:'Ver detalle del corte'}).first().click();
    await page.getByRole('dialog').waitFor();
    await assertDialogBounds();
    assert.match(await page.getByRole('dialog').innerText(),/Efectivo contado/);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await panel().getByRole('button',{name:'Ver detalle',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  });
  await check('filtros de cortes combinan folio, responsable, estado y fechas sin alterar KPI de hoy',async()=>{
    const income=await page.getByRole('heading',{name:'Ingresos de hoy',exact:true}).locator('../..').innerText();
    await panel().getByRole('textbox',{name:'Buscar corte'}).fill('jose alvarez');
    assert.match(await panel().innerText(),/2 cortes encontrados/);
    await panel().getByRole('combobox',{name:'Estado del corte'}).click();
    await page.getByRole('option',{name:'Abiertos',exact:true}).click();
    assert.match(await panel().innerText(),/No hay cortes registrados/);
    await panel().getByRole('button',{name:'Limpiar búsqueda'}).click();
    const folio=await panel().locator('tbody tr').first().locator('td').nth(1).innerText();
    await panel().getByRole('textbox',{name:'Buscar corte'}).fill(folio);
    assert.equal(await panel().locator('tbody tr').count(),1);
    await panel().getByRole('button',{name:'Limpiar búsqueda'}).click();
    assert.equal(await page.getByRole('heading',{name:'Ingresos de hoy',exact:true}).locator('../..').innerText(),income);
    await panel().locator('tbody tr').first().click();
  });
  for(const size of [{width:1280,height:720},{width:1024,height:600},{width:375,height:667}]) {
    await check('detalle de corte paginado y accesible '+size.width+'x'+size.height,async()=>{
      await page.setViewportSize(size);
      await panel().getByRole('button',{name:'Ver detalle',exact:true}).click();
      await assertDialogBounds();
      assert.match(await page.getByRole('dialog').innerText(),/1-10 de 44 movimientos/);
      await page.getByRole('dialog').getByRole('button',{name:'Pagina siguiente'}).click();
      assert.match(await page.getByRole('dialog').innerText(),/11-20 de 44 movimientos/);
      await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,'corte-'+size.width+'.png')});
      await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
      await assertNoOverflow();
    });
  }
  await page.setViewportSize({width:1366,height:768});
  await check('exportación del corte seleccionado contiene todo el corte y omite cancelados',async()=>{
    const pending=page.waitForEvent('download');
    await panel().getByRole('button',{name:'Exportar CSV'}).click();
    const download=await pending;const file=await download.path();const csv=readFileSync(file,'utf8');
    assert.ok(csv.includes('Venta con muchos productos'));
    assert.ok(!csv.includes('Consulta 35'));
    assert.ok(csv.includes('CC-'));
  });
  await page.getByRole('tab',{name:'Reportes',exact:true}).click();
  await check('reporte fecha a fecha: validación, periodo aplicado, productos y movimientos paginados',async()=>{
    await panel().getByRole('button',{name:'Hoy',exact:true}).click();
    assert.match(await panel().innerText(),/1-10 de 31 productos/);
    assert.match(await panel().innerText(),/1-10 de 42 movimientos/);
    assert.match(await panel().innerText(),/1-7 de 7 categorías/);
    await panel().getByLabel('Desde',{exact:true}).fill(dateString(1));
    assert.match(await panel().innerText(),/La fecha inicial no puede ser posterior/);
    assert.equal(await panel().getByRole('button',{name:'Generar reporte'}).isDisabled(),true);
    assert.match(await panel().innerText(),/1-10 de 31 productos/);
    await panel().getByLabel('Desde',{exact:true}).fill('');
    assert.match(await panel().innerText(),/Selecciona la fecha inicial/);
    await panel().getByRole('button',{name:'Hoy',exact:true}).click();
    const productCard=panel().getByRole('heading',{name:'Ventas por producto',exact:true}).locator('../..');
    await productCard.getByRole('button',{name:'Pagina siguiente'}).click();
    assert.match(await productCard.innerText(),/11-20 de 31 productos/);
    await panel().getByRole('button',{name:'Este mes',exact:true}).click();
    assert.match(await productCard.innerText(),/1-10 de 31 productos/);
    assert.match(await panel().innerText(),/Sin base de comparación/);
  });
  await check('CSV y PDF incluyen el rango aplicado completo, aunque se vea una página',async()=>{
    await panel().getByRole('button',{name:'Hoy',exact:true}).click();
    const pendingCsv=page.waitForEvent('download');
    await panel().getByRole('button',{name:'Descargar CSV'}).click();
    const csvDownload=await pendingCsv;const csv=readFileSync(await csvDownload.path(),'utf8');
    assert.equal(csvDownload.suggestedFilename(),`reporte_financiero_${dateString()}_${dateString()}.csv`);
    assert.ok(csv.includes('"Producto 30","1","90","20","70"'), 'CSV contains last product with discount, outside first page');
    assert.ok(csv.includes('"Gasto 6"'));
    assert.ok(!csv.includes('Consulta 35'));
    assert.ok(!csv.includes('Apertura / Fondo de Caja'));
    const pendingPdf=page.waitForEvent('download');
    await panel().getByRole('button',{name:'Descargar PDF'}).click();
    const pdfDownload=await pendingPdf;const pdf=readFileSync(await pdfDownload.path());
    assert.ok(pdf.subarray(0,4).toString()==='%PDF');
    assert.ok(pdf.length>10000);
  });
  await check('rango sin registros tiene vacíos claros; reporte responsive en laptop y móvil',async()=>{
    await panel().getByLabel('Desde',{exact:true}).fill('2020-01-01');
    await panel().getByLabel('Hasta (incluido)').fill('2020-01-01');
    await panel().getByRole('button',{name:'Generar reporte'}).click();
    assert.match(await panel().innerText(),/No hay ventas de productos/);
    assert.match(await panel().innerText(),/Sin cobros para calcular porcentaje/);
    await panel().getByRole('button',{name:'Hoy',exact:true}).click();
    for(const size of [{width:1280,height:720},{width:1024,height:600},{width:375,height:667}]) {
      await page.setViewportSize(size);
      await assertNoOverflow();
      await panel().getByRole('heading',{name:'Comparativa',exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,'reporte-'+size.width+'.png')});
    }
  });
  await check('abrir caja conserva formulario y salida en pantalla de poca altura',async()=>{
    await page.setViewportSize({width:1024,height:600});
    await page.getByRole('button',{name:'Abrir caja',exact:true}).first().click();
    await assertDialogBounds();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'hidden'});
  });
  await check('errores de datos no se presentan como totales cero ni habilitan exportación',async()=>{
    await page.goto(base+'?unavailable');
    await page.getByRole('tab',{name:'Reportes',exact:true}).click();
    assert.match(await panel().innerText(),/Reporte no disponible/);
    assert.equal(await panel().getByRole('button',{name:'Descargar CSV'}).isDisabled(),true);
    await page.goto(base+'?inventory-error');
    await page.getByRole('tab',{name:'Reportes',exact:true}).click();
    assert.match(await panel().innerText(),/Reporte no disponible/);
    await page.goto(base+'?accounts-error');
    await page.getByRole('tab',{name:'Pendientes',exact:true}).click();
    assert.match(await panel().innerText(),/No se pudieron cargar las cuentas pendientes/);
  });
  await check('consulta con caja vencida no ejecuta cierres sin permiso',async()=>{
    await page.goto(base+'?readonly&overdue');
    await page.getByRole('tab',{name:'Corte',exact:true}).click();
    assert.equal(await panel().getByRole('button',{name:'Cerrar corte manual'}).isDisabled(),true);
    assert.equal(await panel().getByRole('button',{name:'Cerrar automatico',exact:true}).isDisabled(),true);
    assert.equal(await page.evaluate(()=>globalThis.__cashWrites||0),0);
  });
  assert.deepEqual(errors,[],'No runtime errors');
  console.log(`${passed} browser checks passed; screenshots in .tmp/caja-audit`);
} finally {
  writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({passed,errors},null,2));
  await browser.close();server.close();
}
