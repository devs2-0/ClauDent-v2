// Requires the official @firebase/rules-unit-testing package in .tmp/testing.
// Only uses the local demo emulator. Never use a production project here.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../.tmp/testing/package.json', import.meta.url));
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, query, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const env = await initializeTestEnvironment({projectId:'demo-claudent-permissions',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
let count=0;
const test = async (name, fn) => {await fn();count++;console.log(`PASS ${name}`);};
let uid=0;
const user = async permissions => {
  const id=`fixture-${++uid}`;
  await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'usuarios',id),{status:'active',roleIds:['fixture-role'],permissions,isAdmin:false}));
  return env.authenticatedContext(id,{email:`${id}@example.test`}).firestore();
};
const record=['patients.view','patients.record.view'];
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    for(const [path,data] of Object.entries({
      'pacientes/patient':{nombres:'Fixture',estado:'activo'},
      'pacientes/patient/historial/entry':{servicios:[],notas:'original'},
      'pacientes/patient/historia_clinica/form':{nota:'original'},
      'pacientes/patient/odontograma/chart':{dientes:{}},
      'servicios/service':{nombre:'Fixture'}, 'paquetes/package':{nombre:'Fixture'},
      'cotizaciones/quotation':{pacienteId:'patient',estado:'borrador'},
      'citas/appointment':{status:'scheduled',doctorId:'doctor'},
      'bloqueosAgenda/block':{status:'active',staffType:'doctor',staffId:'doctor'},
      'horariosPersonal/schedule':{staffType:'doctor',staffId:'doctor',status:'active'},
      'pagos/payment':{pacienteId:'patient',monto:100,estado:'activo'},
      'cortesCaja/open':{estado:'abierto',fecha:Timestamp.now()},
      'cuentasPorCobrar/account':{pacienteId:'patient',total:100},
      'roles/fixture-role':{name:'Fixture',permissions:['patients.view'],isSystem:false,isAdmin:false,status:'active'},
      'roles/system-dentist':{name:'Dentista',permissions:['patients.view'],isSystem:true,isAdmin:false,status:'active'},
    }))await setDoc(doc(db,path),data);
  });
  await test('A: solo ver pacientes lee lista, sin escrituras ni subcolecciones',async()=>{
    const db=await user(['patients.view']);
    await assertSucceeds(getDocs(collection(db,'pacientes')));
    await assertFails(setDoc(doc(db,'pacientes/new'),{nombres:'Denied'}));
    await assertFails(updateDoc(doc(db,'pacientes/patient'),{nombres:'Denied'}));
    await assertFails(deleteDoc(doc(db,'pacientes/patient')));
    for(const sub of ['historial','historia_clinica','odontograma'])await assertFails(getDocs(collection(db,`pacientes/patient/${sub}`)));
  });
  await test('B: ficha no concede procedimientos, pagos ni historia clínica',async()=>{
    const db=await user(record);
    await assertSucceeds(getDoc(doc(db,'pacientes/patient')));
    await assertFails(getDocs(collection(db,'pacientes/patient/historial')));
    await assertFails(getDocs(query(collection(db,'pagos'),where('pacienteId','==','patient'))));
  });
  for(const [module,collectionName,id] of [['services','servicios','service'],['packages','paquetes','package'],['quotations','cotizaciones','quotation']]) {
    await test(`${module}: ver no concede crear/editar/eliminar`,async()=>{
      const db=await user([`${module}.view`]);
      await assertSucceeds(getDocs(collection(db,collectionName)));
      await assertFails(setDoc(doc(db,collectionName,'new'),{nombre:'Denied'}));
      await assertFails(updateDoc(doc(db,collectionName,id),{nombre:'Denied'}));
      await assertFails(deleteDoc(doc(db,collectionName,id)));
      if(module==='packages')await assertFails(getDocs(collection(db,'servicios')));
      if(module==='services')await assertFails(getDocs(collection(db,'paquetes')));
    });
    await test(`${module}: cada acción requiere exclusivamente su concesión explícita`,async()=>{
      const creator=await user([`${module}.view`,`${module}.create`]);
      await assertSucceeds(setDoc(doc(creator,collectionName,'created'),{nombre:'Created'}));
      await assertFails(updateDoc(doc(creator,collectionName,'created'),{nombre:'Denied'}));
      const editor=await user([`${module}.view`,`${module}.update`]);
      await assertSucceeds(updateDoc(doc(editor,collectionName,'created'),{nombre:'Edited'}));
      await assertFails(deleteDoc(doc(editor,collectionName,'created')));
      const remover=await user([`${module}.view`,`${module}.delete`]);
      await assertSucceeds(updateDoc(doc(remover,collectionName,'created'),{estado:'inactivo'}));
      await assertFails(updateDoc(doc(remover,collectionName,'created'),{nombre:'Denied'}));
      await assertSucceeds(deleteDoc(doc(remover,collectionName,'created')));
    });
  }
  await test('Procedimientos: leer, crear, editar y eliminar están separados',async()=>{
    const grants=[...record,'patients.procedures.view'];
    const viewer=await user(grants);
    await assertSucceeds(getDocs(collection(viewer,'pacientes/patient/historial')));
    await assertFails(setDoc(doc(viewer,'pacientes/patient/historial/new'),{servicios:[]}));
    const creator=await user([...grants,'patients.procedures.create']);
    await assertSucceeds(setDoc(doc(creator,'pacientes/patient/historial/new'),{servicios:[]}));
    await assertFails(updateDoc(doc(creator,'pacientes/patient/historial/entry'),{notas:'Denied'}));
    const editor=await user([...grants,'patients.procedures.update']);
    await assertSucceeds(updateDoc(doc(editor,'pacientes/patient/historial/entry'),{notas:'Edited'}));
    await assertFails(deleteDoc(doc(editor,'pacientes/patient/historial/entry')));
    const remover=await user([...grants,'patients.procedures.delete']);
    await assertSucceeds(deleteDoc(doc(remover,'pacientes/patient/historial/new')));
  });
  await test('Pagos del paciente: lectura sin acceso ni escrituras de caja',async()=>{
    const db=await user([...record,'patients.payments.view']);
    await assertSucceeds(getDocs(query(collection(db,'pagos'),where('pacienteId','==','patient'))));
    await assertSucceeds(getDocs(query(collection(db,'cuentasPorCobrar'),where('pacienteId','==','patient'))));
    await assertFails(getDocs(collection(db,'cortesCaja')));
    await assertFails(setDoc(doc(db,'pagos/new'),{pacienteId:'patient',monto:100}));
  });
  await test('Agenda: solo ver no crea/edita/cancela ni gestiona disponibilidad',async()=>{
    const db=await user(['agenda.view']);
    await assertSucceeds(getDocs(collection(db,'citas')));
    await assertFails(setDoc(doc(db,'citas/new'),{status:'scheduled'}));
    await assertFails(updateDoc(doc(db,'citas/appointment'),{status:'cancelled'}));
    await assertFails(updateDoc(doc(db,'horariosPersonal/schedule'),{status:'inactive'}));
    await assertFails(setDoc(doc(db,'bloqueosAgenda/new'),{status:'active'}));
    await assertFails(setDoc(doc(db,'historialAgenda/new'),{title:'Denied'}));
  });
  await test('Agenda: crear no edita; editar no cancela; cancelar no modifica otros campos',async()=>{
    const creator=await user(['agenda.view','agenda.appointments.create']);
    await assertSucceeds(setDoc(doc(creator,'citas/new'),{status:'scheduled'}));
    await assertFails(updateDoc(doc(creator,'citas/new'),{status:'completed'}));
    const editor=await user(['agenda.view','agenda.appointments.update']);
    await assertSucceeds(updateDoc(doc(editor,'citas/new'),{status:'completed'}));
    await assertFails(updateDoc(doc(editor,'citas/new'),{status:'cancelled'}));
    const canceller=await user(['agenda.view','agenda.appointments.cancel']);
    await assertFails(updateDoc(doc(canceller,'citas/new'),{status:'cancelled',doctorId:'different'}));
    await assertSucceeds(updateDoc(doc(canceller,'citas/new'),{status:'cancelled'}));
  });
  await test('Bloqueos y horarios: permisos separados por acción y tipo de personal',async()=>{
    const doctor=await user(['agenda.view','agenda.doctors.view','agenda.doctors.manage','agenda.availability.view']);
    await assertSucceeds(updateDoc(doc(doctor,'horariosPersonal/schedule'),{status:'inactive'}));
    await assertFails(setDoc(doc(doctor,'horariosPersonal/assistant'),{staffType:'assistant',staffId:'assistant'}));
    await assertFails(setDoc(doc(doctor,'bloqueosAgenda/new'),{status:'active'}));
    const remover=await user(['agenda.view','agenda.availability.view','agenda.blocks.delete']);
    await assertSucceeds(updateDoc(doc(remover,'bloqueosAgenda/block'),{status:'cancelled'}));
    await assertFails(updateDoc(doc(remover,'bloqueosAgenda/block'),{staffId:'different'}));
  });
  await test('No es posible autoconcederse permisos desde el perfil',async()=>{
    const db=await user(['patients.view']);
    await assertFails(updateDoc(doc(db,'usuarios',`fixture-${uid}`),{permissions:['patients.view','patients.delete'],isAdmin:true}));
  });
  await test('Pacientes: crear no edita; eliminar solo permite la baja existente',async()=>{
    const creator=await user(['patients.view','patients.create']);
    await assertSucceeds(setDoc(doc(creator,'pacientes/created'),{nombres:'Created',estado:'activo'}));
    await assertFails(updateDoc(doc(creator,'pacientes/created'),{nombres:'Denied'}));
    const remover=await user(['patients.view','patients.delete']);
    await assertFails(updateDoc(doc(remover,'pacientes/created'),{nombres:'Denied',estado:'inactivo'}));
    await assertSucceeds(updateDoc(doc(remover,'pacientes/created'),{estado:'inactivo'}));
  });
  await test('Venta: conserva cobro, procedimiento automático y liquidación de cotización',async()=>{
    const db=await user(['sales.view','sales.create']);
    const paymentId=`sale-${uid}`;
    const fecha=Timestamp.now();
    const batch=writeBatch(db);
    batch.set(doc(db,'pagos',paymentId),{corteId:'open',pacienteId:'patient',fecha,metodo:'efectivo',monto:100,concepto:'Fixture',origen:'cotizacion',estado:'activo',usuarioId:`fixture-${uid}`,cotizacionId:'quotation'});
    batch.set(doc(db,'pacientes/patient/historial/sale'),{servicios:[],fecha,total:100,pagoId:paymentId});
    batch.set(doc(db,'tratamientos/sale'),{pacienteId:'patient',pagoId:paymentId,total:100});
    batch.set(doc(db,'cajaMovimientos/sale'),{corteId:'open',fecha,tipo:'ingreso',metodo:'efectivo',concepto:'Fixture',monto:100,referenciaTipo:'cotizacion',referenciaId:paymentId,estado:'activo',usuarioId:`fixture-${uid}`});
    batch.update(doc(db,'cotizaciones/quotation'),{estado:'activo',pagada:true,pagoId:paymentId,tratamientoId:'sale',fechaPago:fecha,metodoPago:'efectivo'});
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(doc(db,'pacientes/patient/historial/reuse'),{pagoId:paymentId,servicios:[]}));
    await assertFails(updateDoc(doc(db,'cotizaciones/quotation'),{notas:'Denied'}));
  });
  await test('Historia clínica y odontograma: lectura nunca habilita modificaciones',async()=>{
    const viewer=await user([...record,'patients.clinicalHistory.view','patients.odontogram.view']);
    await assertSucceeds(getDocs(collection(viewer,'pacientes/patient/historia_clinica')));
    await assertSucceeds(getDocs(collection(viewer,'pacientes/patient/odontograma')));
    await assertFails(updateDoc(doc(viewer,'pacientes/patient/historia_clinica/form'),{nota:'Denied'}));
    await assertFails(updateDoc(doc(viewer,'pacientes/patient/odontograma/chart'),{dientes:{}}));
    const editor=await user([...record,'patients.clinicalHistory.view','patients.clinicalHistory.update']);
    const batch=writeBatch(editor);
    batch.set(doc(editor,'pacientes/patient/historia_clinica/new'),{nota:'Created'});
    batch.update(doc(editor,'pacientes/patient'),{hasHistorial:true});
    await assertSucceeds(batch.commit());
  });
  await test('Roles existentes: admin puede asignar vistas nuevas sin alterar la identidad del rol de sistema',async()=>{
    const editor=await user(['roles.view','roles.update']);
    await assertFails(updateDoc(doc(editor,'roles/system-dentist'),{permissions:record}));
    await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'usuarios',`fixture-${uid}`),{isAdmin:true}));
    await assertSucceeds(updateDoc(doc(editor,'roles/system-dentist'),{permissions:record}));
    await assertFails(updateDoc(doc(editor,'roles/system-dentist'),{isSystem:false}));
    await assertFails(updateDoc(doc(editor,'roles/system-dentist'),{status:'archived'}));
  });
  assert.ok(count >= 14);
  console.log(`${count} escenarios de Firestore aprobados.`);
} finally { await env.cleanup(); }
