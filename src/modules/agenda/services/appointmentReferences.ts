import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Appointment, UpdateAppointmentInput } from '../types/agenda.types';

// Existing patient/service IDs may remain as historical references when a doctor
// is replaced. A new assignment must still resolve in its current catalog.
export const assertAppointmentReferences = async (input: UpdateAppointmentInput, previous?: Appointment) => {
  const checks: Promise<void>[] = [];
  const check = async (collection: string, id: string, label: string, active = false) => {
    const snapshot = await getDoc(doc(db, collection, id));
    if (!snapshot.exists() || (active && (snapshot.data().status !== 'active' || snapshot.data().deletedAt))) {
      throw new Error(`${label} eliminado o no disponible. Actualiza la selección.`);
    }
  };
  if (input.doctorId) checks.push(check('doctores', input.doctorId, 'Doctor', true));
  if (input.patientId && input.patientId !== previous?.patientId) checks.push(check('pacientes', input.patientId, 'Paciente'));
  if (input.serviceId && input.serviceId !== previous?.serviceId) checks.push(check('servicios', input.serviceId, 'Servicio'));
  input.assistantIds?.filter((id) => !previous?.assistantIds.includes(id)).forEach((id) => checks.push(check('asistentes', id, 'Asistente', true)));
  if (input.walkInAssistantId && input.walkInAssistantId !== previous?.walkInAssistantId) checks.push(check('asistentes', input.walkInAssistantId, 'Asistente', true));
  await Promise.all(checks);
};
