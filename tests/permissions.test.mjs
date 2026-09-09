// Run: node tests/permissions.test.mjs. All data and auth are local fixtures.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { existsSync } from 'node:fs';

process.env.NODE_ENV = 'production';

const root = process.cwd();
const mocks = {
  '@/auth': `
    export { useCan } from '${root.replaceAll('\\', '/')}/src/auth/hooks/useCan.ts';
    export { Can } from '${root.replaceAll('\\', '/')}/src/auth/components/Can.tsx';
    export { useCurrentUserProfile } from 'fixture-profile';
    export { useAuth } from 'fixture-auth';
    export const usePermissions = () => { const can = globalThis.permissionTest.can; return {hasPermission:can}; };
  `,
  'fixture-profile': `export const useCurrentUserProfile = () => ({profile:globalThis.permissionTest.profile, loading:false});`,
  'fixture-auth': `export const useAuth = () => ({currentUser:{uid:'fixture'},authLoading:false});`,
  '@/modules/patients': `export const usePatients = () => globalThis.permissionTest.patients; export const initialState = {};`,
  '@/modules/services': `export const useDentalServices = () => ({services:[{id:'service',nombre:'Servicio de prueba',precio:100,estado:'activo'}],servicesLoading:false});`,
  '@/modules/packages': `export const usePackages = () => ({paquetes:[{id:'package',nombre:'Paquete de prueba',serviciosIncluidos:[],estado:'activo',fechaInicio:'2020-01-01',fechaFin:'2099-01-01',precioTotal:200}],paquetesLoading:false}); export {default as ServiciosPaquetes} from '${root.replaceAll('\\', '/')}/src/modules/packages/components/ServiciosPaquetes.tsx';`,
  '@/modules/quotations': `export const useQuotations = () => ({quotations:[],quotationsLoading:false});`,
  '@/modules/ventas': `export const accountsReceivableService = {}; export const useCashRegister = () => {throw new Error('CashProvider must not be required for limited roles');};`,
  '@/modules/agenda': `export const appointmentService = {};`,
  '@/modules/agenda/services/assistantService': `export const assistantService = {};`,
  '@/modules/agenda/services/doctorService': `export const doctorService = {};`,
  '@/modules/inventario/store/InventoryProvider': `export const useOptionalInventory = () => undefined;`,
  '@/modules/ventas/store/CashProvider': `export const useOptionalCash = () => undefined;`,
  '@/modules/ventas/services/cashService': `export const cashService = {};`,
  '@/shared/services/currentUserIdentity': `export const getCurrentUserIdentity = () => ({});`,
  '@/lib/firebase': `export const db = {}; export const storage = {};`,
  '@/modules/audit/services/auditService': `export const addAuditLog = () => {};`,
};
const entry = `
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {MemoryRouter, Routes, Route} from 'react-router-dom';
  import {TooltipProvider} from './src/shared/components/ui/tooltip';
  import Patients from './src/modules/patients/pages/PatientsPage';
  import Record from './src/modules/patients/pages/PatientRecordPage';
  import Services from './src/modules/services/pages/ServicesPage';
  import Dashboard from './src/modules/dashboard/pages/DashboardPage';
  import History from './src/modules/patients/components/PatientHistory';
  import Payments from './src/modules/patients/components/PatientPayments';
  import {ProtectedRouteByPermission} from './src/auth/guards/ProtectedRouteByPermission';
  import {permissionCatalog} from './src/auth/constants/permissionCatalog';
  import {getPermissionDependencies, hasGrantedPermission, togglePermissionGrant} from './src/auth/constants/permissionDependencies';
  export {permissionCatalog, getPermissionDependencies, hasGrantedPermission, togglePermissionGrant};
  export function render(name, permission, anyPermission) {
    const pages = {Patients, Record, Services, Dashboard, History, Payments};
    const Page = pages[name];
    const content = <Page patientId="patient" patientName="Paciente Prueba"/>;
    return renderToStaticMarkup(<TooltipProvider><MemoryRouter initialEntries={['/pacientes/patient']}><Routes><Route path="/pacientes/:id" element={permission || anyPermission ? <ProtectedRouteByPermission permission={permission} anyPermission={anyPermission}>{content}</ProtectedRouteByPermission> : content}/></Routes></MemoryRouter></TooltipProvider>);
  }
`;
const bundle = await build({
  stdin:{contents:entry,resolveDir:root,loader:'tsx'}, jsx:'automatic', bundle:true,write:false,format:'cjs',platform:'node',packages:'external',logLevel:'silent',
  plugins:[{name:'local-fixtures',setup(b){
    b.onResolve({filter:/.*/},args=>{
      if(args.path === './useAuth' || (args.path.endsWith('/useAuth') && !args.path.startsWith('@/'))) return {path:'fixture-auth',namespace:'fixture'};
      if(args.path === './useCurrentUserProfile') return {path:'fixture-profile',namespace:'fixture'};
      if(mocks[args.path])return {path:args.path,namespace:'fixture'};
      if(args.path.startsWith('@/')) {
        const base = path.join(root,'src',args.path.slice(2));
        return {path:['.ts','.tsx','/index.ts','/index.tsx',''].map(ext=>base+ext).find(file=>existsSync(file))};
      }
    });
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));
  }}],
});
const require = createRequire(import.meta.url);
const module = {exports:{}};
// React SSR emits browser-only layout-effect warnings; errors still fail the tests.
const quietConsole = {...console,error:(message,...args)=>{if(!String(message).includes('useLayoutEffect'))console.error(message,...args);}};
const context = {require,module,exports:module.exports,console:quietConsole,process,Buffer,setTimeout,clearTimeout,URL,URLSearchParams};
context.globalThis = context;
vm.runInNewContext(bundle.outputFiles[0].text, context, {filename:'permissions-fixtures.cjs'});
const api = module.exports;
let checks = 0;
const check = (name,fn) => {fn(); checks++; console.log(`PASS ${name}`);};
const useGrants = grants => {
  context.permissionTest = {profile:{uid:'fixture',status:'active',roleIds:['test'],permissions:grants,isAdmin:false},can:p=>api.hasGrantedPermission(grants,p),patients:{patients:[{id:'patient',nombres:'Paciente',apellidos:'Prueba',estado:'activo',fechaRegistro:'2026-01-01',fechaNacimiento:'2000-01-01'}],patientsLoading:false,searchQuery:''}};
};
useGrants(['patients.view']);
check('A: listado sin crear, editar, eliminar, seleccionar ni ficha',()=>{
  const html=api.render('Patients','patients.view');
  assert.match(html,/Paciente/);
  for(const label of ['Nuevo Paciente','aria-label="Editar"','Eliminar a Paciente','Ver ficha','Seleccionar a Paciente'])assert.ok(!html.includes(label),label);
  assert.ok(!api.render('Record','patients.record.view').includes('Antecedentes'));
});
useGrants(['patients.view','patients.record.view']);
check('B: ficha sin pestañas clínicas, pagos ni acciones',()=>{
  assert.match(api.render('Patients'),/Ver ficha/);
  const html=api.render('Record','patients.record.view');
  assert.match(html,/Información Personal/);
  for(const label of ['Antecedentes','Procedimientos','Pagos','Cotizaciones','Odontograma','>Editar<','>Eliminar<'])assert.ok(!html.includes(label),label);
});
for(const [module,shown,hidden] of [['packages','Paquetes','Servicios individuales'],['services','Servicios individuales','>Paquetes<']]) {
  useGrants([`${module}.view`]);
  check(`${module}: acceso independiente y sin acciones`,()=>{
    const html=api.render('Services',undefined,['services.view','packages.view']);
    assert.ok(html.includes(shown)); assert.ok(!html.includes(hidden));
    assert.ok(!html.includes('aria-label="Editar"')); assert.ok(!html.includes('aria-label="Eliminar"')); assert.ok(!html.includes('Nuevo Servicio'));assert.ok(!html.includes('Nuevo Paquete'));
  });
}
useGrants(['dashboard.view','agenda.view','agenda.appointments.create']);
check('E: asistente solo ve Nueva cita; conserva resúmenes limpios',()=>{
  const html=api.render('Dashboard');
  assert.match(html,/Nueva cita/);assert.match(html,/Resumen de agenda/);assert.match(html,/Paquetes activos/);assert.match(html,/Información no disponible/);
  for(const label of ['Nueva venta','Nueva cotización','Nuevo paciente'])assert.ok(!html.includes(label),label);
});
check('F: cada vista individual carece de permisos de escritura',()=>{
  for(const view of api.permissionCatalog.filter(p=>p.level==='read')) {
    const grants=[view.key,...api.getPermissionDependencies(view.key)];
    for(const write of api.permissionCatalog.filter(p=>p.level!=='read'))assert.equal(api.hasGrantedPermission(grants,write.key),false,`${view.key} -> ${write.key}`);
  }
});
check('Dependencias: no activar hijos sin padre y retirar descendientes',()=>{
  assert.equal(api.togglePermissionGrant(['packages.view'],'services.create').length,1);
  assert.deepEqual(Array.from(api.togglePermissionGrant(['packages.view','packages.create','packages.delete'],'packages.view')),[]);
  assert.equal(api.hasGrantedPermission(['patients.procedures.create'],'patients.procedures.create'),false);
});
useGrants(['patients.view','patients.record.view','patients.procedures.view','patients.payments.view']);
check('Historial y Pagos se montan sin proveedores de inventario/caja',()=>{
  assert.doesNotThrow(()=>api.render('History'));
  assert.doesNotThrow(()=>api.render('Payments'));
});
console.log(`${checks} escenarios de permisos aprobados.`);
