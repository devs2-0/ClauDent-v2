import { assertAppointmentReferences } from '../src/modules/agenda/services/appointmentReferences';
import { legacyCategories, resolveServiceCategory, saveCategory } from '../src/modules/services/utils/categoryCatalog';
import { historicalDoctors, selectedDayLabel } from '../src/modules/agenda/utils/historicalDoctors';
import { doctorService } from '../src/modules/agenda/services/doctorService';
import { assistantService } from '../src/modules/agenda/services/assistantService';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { records, Timestamp } from './firestoreStub';
import { categoryKey, categoryOptions, normalizeCategory } from '../src/modules/services/utils/categories';
import { addDuration, parseLocalDate, isValidDuration } from '../src/shared/utils/duration';
import { isBirthdayToday, latestProcedureDate, patientReviewDue } from '../src/modules/patients/utils/patientAlerts';
import { prepareClinicalHistory } from '../src/modules/patients/utils/clinicalHistoryForm';
import { initialState } from '../src/modules/patients/types/clinicalHistory.types';
import { getClinicalHistoryStatus } from '../src/modules/patients/utils/patientUi';
import { createModalDraftStore } from '../src/shared/utils/modalDraft';
import { readPatientInactivitySettings } from '../src/modules/patients/hooks/usePatientInactivitySettings';
import { isRoleExpired } from '../src/auth/utils/roleLifetime';
import { roleService } from '../src/auth/services/roleService';
import { userService } from '../src/auth/services/userService';
import { userInvitationService } from '../src/auth/services/userInvitationService';
import { hasGrantedPermission } from '../src/auth/constants/permissionDependencies';
import type { Patient } from '../src/modules/patients/types/patient.types';

const patient: Patient = { id: 'p1', nombres: 'Paciente', apellidos: 'Prueba', fechaRegistro: '2026-05-20', fechaNacimiento: '1995-09-20', sexo: 'F', telefonoPrincipal: '555', correo: '', estado: 'activo', estadoCivil: 'Casado(a)' };
const now = new Date('2026-09-20T12:00:00');
const role = { id: 'r1', name: 'Temporal', permissions: ['patients.view'], isSystem: false, isAdmin: false, status: 'active', temporary: true, expiresAt: Timestamp.fromDate(new Date(Date.now() - 60000)) };
beforeEach(() => records.clear());

test('categories group accents, case and spaces, prefer accented labels and omit blanks', () => {
  const options = categoryOptions(['categoria', 'Categoría', 'CATEGORIA', '', '   ', ' limpieza   dental ']);
  assert.deepEqual([...options.values()], ['Categoría', 'Limpieza Dental']);
  assert.equal(categoryKey(' CATEGORÍA '), 'categoria');
  assert.equal(normalizeCategory('categoria', [...options.values()]), 'Categoría');
  assert.equal(normalizeCategory('nueva categoría', []), 'Nueva Categoría');
});

test('durations support all six units and calendar boundaries', () => {
  const start = new Date('2024-01-31T12:00:00');
  assert.equal(addDuration(start, { value: 1, unit: 'months' }).getDate(), 29);
  assert.equal(addDuration(new Date('2024-02-29T12:00:00'), { value: 1, unit: 'years' }).getDate(), 28);
  for (const [unit, minutes] of [['minutes', 1], ['hours', 60], ['days', 1440], ['weeks', 10080]] as const) {
    assert.equal((addDuration(start, { value: 1, unit }).getTime() - start.getTime()) / 60000, minutes);
  }
  assert.equal(isValidDuration({ value: 1.5, unit: 'days' }), false);
  assert.equal(parseLocalDate('2025-02-29'), null);
  assert.equal(parseLocalDate('not-a-date'), null);
});

test('review alerts use four calendar months and latest actual activity; missing dates are not invented', () => {
  assert.equal(patientReviewDue(patient, { value: 4, unit: 'months' }, now)?.source, 'registro del paciente');
  assert.equal(patientReviewDue(patient, { value: 4, unit: 'months' }, new Date('2026-09-19T23:59:59')), null);
  assert.equal(patientReviewDue(patient, { value: 4, unit: 'months' }, now, '2026-07-01'), null);
  assert.equal(patientReviewDue(patient, { value: 4, unit: 'months' }, now, undefined, undefined, '2026-08-01'), null);
  assert.equal(patientReviewDue(patient, { value: 1, unit: 'months' }, now, undefined, undefined, '2026-08-01')?.source, 'última consulta odontológica capturada');
  assert.equal(patientReviewDue(patient, { value: 1, unit: 'months' }, now, '2026-06-01', '2026-07-01')?.source, 'última cita atendida');
  assert.equal(patientReviewDue({ ...patient, fechaRegistro: '' }, { value: 4, unit: 'months' }, now), null);
  assert.equal(patientReviewDue(patient, { value: 4, unit: 'months' }, now, '2099-01-01')?.source, 'registro del paciente');
  assert.ok(patientReviewDue({ ...patient, estado: 'inactivo' }, { value: 4, unit: 'months' }, now));
});

test('birthdays use local month/day and ignore missing, invalid and future dates', () => {
  assert.equal(isBirthdayToday(patient.fechaNacimiento, now), true);
  assert.equal(isBirthdayToday('', now), false);
  assert.equal(isBirthdayToday('2099-09-20', now), false);
  assert.equal(isBirthdayToday('2000-02-29', new Date('2025-02-28T12:00:00')), false);
  assert.equal(isBirthdayToday('2000-02-29', new Date('2024-02-29T12:00:00')), true);
});

test('refused procedures and future/invalid dates never reset clinical inactivity', () => {
  assert.equal(latestProcedureDate([
    { fecha: '2026-05-21' },
    { fecha: '2026-09-19', pacienteNiegaProcedimientos: true },
    { fecha: '2099-01-01' }, { fecha: 'invalid' }, { fecha: null },
  ], now), '2026-05-21');
});

test('clinical history prefills equivalent fields and preserves captured data, false values and legacy text', () => {
  const fresh = prepareClinicalHistory(patient);
  assert.equal(fresh.historiaGeneral.telefono, '555');
  assert.equal(fresh.historiaGeneral.estado_civil, 'Casado(a)');
  const existing = prepareClinicalHistory(patient, { historiaGeneral: { ...initialState.historiaGeneral, telefono: '777', paciente_niega_procedimientos: false }, apnp: { ...initialState.apnp, auxiliares_cuales: 'Cepillo interdental', cartilla_vacunacion: false } });
  assert.equal(existing.historiaGeneral.telefono, '777');
  assert.equal(existing.historiaGeneral.paciente_niega_procedimientos, false);
  assert.equal(existing.apnp.auxiliares_cuales, 'Cepillo interdental');
  assert.equal(existing.apnp.cartilla_vacunacion, false);
  assert.equal(initialState.historiaGeneral.telefono, '');
  assert.equal(getClinicalHistoryStatus({ apnp: { cartilla_vacunacion: false } }), 'incomplete');
});

test('drafts recover incomplete information, isolate accounts/patients and discard explicitly', () => {
  const storage = new Map<string, string>();
  (globalThis as any).window = { localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } };
  const store = createModalDraftStore('u1.p1');
  assert.equal(store.save({ nombres: 'Incompleto' }), true);
  assert.deepEqual(createModalDraftStore('u1.p1').read(), { nombres: 'Incompleto' });
  assert.equal(createModalDraftStore('u2.p1').read(), null);
  assert.equal(createModalDraftStore('u1.p2').read(), null);
  store.discard();
  assert.equal(store.read(), null);
  assert.equal(storage.has('u1.p1'), false);
  storage.set('old-draft', JSON.stringify({ savedAt: Date.now() - 8 * 86400000, data: { nombres: 'Old' } }));
  assert.equal(createModalDraftStore('old-draft').read(), null);
  assert.equal(storage.has('old-draft'), false);
});

test('drafts remain recoverable in session when browser storage fails; cancel still discards', () => {
  (globalThis as any).window = { get localStorage() { throw new Error('Blocked'); } };
  const store = createModalDraftStore('blocked-storage');
  assert.equal(store.save({ notas: 'Incompleto' }), false);
  assert.deepEqual(store.read(), { notas: 'Incompleto' });
  store.discard();
  assert.equal(store.read(), null);
});

test('inactivity defaults to four months, retains legacy days and rejects corrupt settings', () => {
  const storage = new Map<string, string>();
  (globalThis as any).window = { localStorage: { getItem: (key: string) => storage.get(key) } };
  assert.deepEqual(readPatientInactivitySettings(), { value: 4, unit: 'months', enabled: true, automatic: { value: 6, unit: 'months' } });
  storage.set('claudent.patient-inactivity-days', '180');
  assert.deepEqual(readPatientInactivitySettings(), { value: 180, unit: 'days', enabled: true, automatic: { value: 6, unit: 'months' } });
  storage.set('claudent.patient-inactivity.v2', JSON.stringify({ value: 3, unit: 'weeks', enabled: false }));
  assert.deepEqual(readPatientInactivitySettings(), { value: 3, unit: 'weeks', enabled: false, automatic: { value: 6, unit: 'months' } });
  storage.clear();
  storage.set('claudent.patient-inactivity.v2', '{malformed');
  assert.deepEqual(readPatientInactivitySettings(), { value: 4, unit: 'months', enabled: true, automatic: { value: 6, unit: 'months' } });
});

test('expired roles are inactive on reads without silently writing, while system/admin roles remain protected', async () => {
  records.set('roles/r1', role);
  assert.equal((await roleService.listRoles())[0].status, 'archived');
  assert.equal(records.get('roles/r1')!.status, 'active');
  assert.equal(isRoleExpired({ ...role, isSystem: true } as any), false);
  assert.equal(isRoleExpired({ ...role, isAdmin: true } as any), false);
  assert.equal(isRoleExpired({ ...role, temporary: false } as any), false);
  await assert.rejects(roleService.updateRole('r1', { status: 'active' }), /duración/);
});

test('processing expiration refreshes assigned user permissions without losing other active roles', async () => {
  records.set('roles/r1', role);
  records.set('roles/permanent', { ...role, id: 'permanent', temporary: false, permissions: ['agenda.view'] });
  records.set('usuarios/u1', { uid: 'u1', email: 'test@example.test', status: 'active', roleIds: ['r1', 'permanent'], permissions: ['patients.view', 'agenda.view'] });
  await roleService.listRoles({ processExpired: true, actorUid: 'admin' });
  assert.equal(records.get('roles/r1')!.status, 'archived');
  assert.deepEqual(records.get('usuarios/u1')!.permissions, ['agenda.view']);
});

test('temporary creation persists duration, protected roles cannot expire or be deleted, assigned roles cannot be deleted', async () => {
  const created = await roleService.createRole({ name: 'Temporal', permissions: ['patients.view'], temporary: true, durationValue: 5, durationUnit: 'minutes' }, 'admin');
  assert.equal(created.durationValue, 5);
  assert.ok(created.expiresAt!.toDate().getTime() > Date.now());
  records.set('roles/system', { ...role, id: 'system', isSystem: true });
  await assert.rejects(roleService.updateRole('system', { temporary: true, durationValue: 1, durationUnit: 'days' }), /protegido/);
  await assert.rejects(roleService.deleteRole('system'), /protegido/);
  records.set('roles/r1', role);
  records.set('usuarios/u1', { roleIds: ['r1'] });
  await assert.rejects(roleService.deleteRole('r1'), /asignado/);
  records.delete('usuarios/u1');
  await roleService.deleteRole('r1');
  assert.equal(records.has('roles/r1'), false);
});

test('deleted user main documents are removed after rereading; self-removal and last-admin removal are rejected', async () => {
  records.set('usuarios/u1', { uid: 'u1', email: 'test@example.test', status: 'active', roleIds: ['r1'] });
  await assert.rejects(userInvitationService.deleteUserAccess('u1', 'u1'), /propia/);
  await userInvitationService.deleteUserAccess('u1', 'admin');
  assert.equal(records.has("usuarios/u1"), false);
  assert.equal((await userService.listUsers()).length, 0);
  records.set('usuarios/admin', { uid: 'admin', email: 'admin@example.test', status: 'active', isAdmin: true });
  await assert.rejects(userInvitationService.deleteUserAccess('admin', 'other'), /último administrador/);
  await assert.rejects(userService.updateUserStatus('admin', 'inactive', 'other'), /último administrador/);
});

test('expired roles cannot be assigned and view permissions never grant writes', async () => {
  records.set('roles/r1', role);
  records.set('usuarios/u1', { uid: 'u1', email: 'test@example.test', status: 'active', roleIds: [] });
  await assert.rejects(userService.assignRoles('u1', ['r1'], 'admin'), /vencido/);
  for (const module of ['patients', 'services', 'roles', 'users'] as const) {
    for (const action of ['create', 'update', 'delete'] as const) {
      assert.equal(hasGrantedPermission([`${module}.view`], `${module}.${action}`), false);
    }
  }
});


test('category catalog normalizes duplicates, retains legacy assignment on rename and clears deleted assignments', () => {
  const initial = legacyCategories(['  endodoncia  ', 'Endodóncia', ' Cirugia oral ']);
  assert.equal(initial.length, 2);
  assert.throws(() => saveCategory(initial, 'ENDODONCIA', 'new'), /existe/);
  const old = initial.find((category) => categoryKey(category.name) === 'endodoncia')!;
  const renamed = saveCategory(initial, 'tratamientos   de conducto', old.id);
  assert.equal(resolveServiceCategory({ categoria: 'Endodoncia' }, renamed)?.name, 'Tratamientos De Conducto');
  const deleted = renamed.filter((category) => category.id !== old.id);
  assert.equal(resolveServiceCategory({ categoria: 'Endodoncia' }, deleted), undefined);
  const recreated = saveCategory(deleted, 'Endodoncia', 'brand-new');
  assert.equal(resolveServiceCategory({ categoria: 'Endodoncia', categoriaId: old.id }, recreated), undefined);
  assert.equal(resolveServiceCategory({ categoria: 'Endodoncia' }, recreated), undefined);
});

test('four-month reminder does not imply six-month inactivity; clinical activity resets both', () => {
  const registered = { ...patient, fechaRegistro: '2026-01-21' };
  const atFourMonths = new Date('2026-05-21T12:00:00');
  assert.ok(patientReviewDue(registered, { value: 4, unit: 'months' }, atFourMonths));
  assert.equal(patientReviewDue(registered, { value: 6, unit: 'months' }, atFourMonths), null);
  const atSixMonths = new Date('2026-07-21T12:00:00');
  assert.ok(patientReviewDue(registered, { value: 6, unit: 'months' }, atSixMonths));
  assert.equal(patientReviewDue(registered, { value: 6, unit: 'months' }, atSixMonths, '2026-07-20'), null);
});

test('deleted doctor references retain future and past appointments without expanding own-doctor scope', () => {
  const appointments = [{ doctorId: 'gone', doctorName: 'Dra. Ana', startDate: '2025-01-01' }, { doctorId: 'gone', startDate: '2027-01-01' }, { doctorId: 'other' }] as any;
  const own = historicalDoctors([], appointments, false, new Set(['gone']));
  assert.equal(own.length, 1);
  assert.equal(own[0].isDeletedReference, true);
  assert.equal(own[0].status, 'inactive');
  assert.match(own[0].nombre, /Ana.*eliminado/);
  assert.equal(appointments.filter((item: any) => own.some((doctor) => doctor.id === item.doctorId)).length, 2);
  assert.equal(historicalDoctors([], appointments, false, new Set()).length, 0);
  assert.equal(historicalDoctors([], appointments, true, new Set()).length, 2);
  assert.equal(selectedDayLabel('2026-09-21'), '21 septiembre 2026');
});

test('expired roles renew with a valid duration or become permanent, never active with a past expiry', async () => {
  records.set('roles/r1', role);
  await assert.rejects(roleService.updateRole('r1', { status: 'active', temporary: true, durationValue: 0, durationUnit: 'days' }), /duración/i);
  await roleService.updateRole('r1', { status: 'active', temporary: true, durationValue: 3, durationUnit: 'days' });
  assert.equal(records.get('roles/r1')!.status, 'active');
  assert.ok(records.get('roles/r1')!.expiresAt.toDate().getTime() > Date.now());
  records.set('roles/r1', role);
  await roleService.updateRole('r1', { status: 'active', temporary: false });
  assert.equal(records.get('roles/r1')!.temporary, false);
  assert.equal(records.get('roles/r1')!.expiresAt, null);
});

test('doctor and assistant deletion removes only catalog documents and keeps historical references', async () => {
  records.set('doctores/d1', { nombre: 'Doctor' });
  records.set('asistentes/a1', { nombre: 'Asistente' });
  records.set('citas/c1', { doctorId: 'd1', assistantIds: ['a1'] });
  records.set('historialAgenda/h1', { doctorId: 'd1' });
  await doctorService.deleteDoctor('d1');
  await assistantService.deleteAssistant('a1');
  assert.equal(records.has('doctores/d1'), false);
  assert.equal(records.has('asistentes/a1'), false);
  assert.equal(records.has('citas/c1'), true);
  assert.equal(records.has('historialAgenda/h1'), true);
  assert.equal(hasGrantedPermission(['agenda.view', 'agenda.doctors.view', 'agenda.doctors.manage'], 'agenda.doctors.delete'), false);
});


test('stale appointment selections cannot assign deleted doctors, services, patients or assistants', async () => {
  records.set('doctores/live', { status: 'active' });
  await assert.rejects(assertAppointmentReferences({ doctorId: 'gone' }), /Doctor eliminado/);
  await assert.rejects(assertAppointmentReferences({ doctorId: 'live', serviceId: 'gone' }), /Servicio eliminado/);
  await assert.rejects(assertAppointmentReferences({ doctorId: 'live', patientId: 'gone' }), /Paciente eliminado/);
  await assert.rejects(assertAppointmentReferences({ doctorId: 'live', assistantIds: ['gone'] }), /Asistente eliminado/);
});

test('future appointment doctor can be replaced while its deleted patient/service remain historical references', async () => {
  records.set('doctores/live', { status: 'active' });
  const previous = { doctorId: 'deleted', patientId: 'old-patient', serviceId: 'old-service', assistantIds: [] } as any;
  await assertAppointmentReferences({ doctorId: 'live', patientId: 'old-patient', serviceId: 'old-service' }, previous);
  await assert.rejects(assertAppointmentReferences({ doctorId: 'deleted' }, previous), /Doctor eliminado/);
});
