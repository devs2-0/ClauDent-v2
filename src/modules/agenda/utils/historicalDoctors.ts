import type { Appointment, Doctor } from '../types/agenda.types';

export const isInactiveCalendarDoctor = (doctor: Doctor) =>
  doctor.status !== 'active' || Boolean(doctor.deletedAt) || Boolean(doctor.isDeletedReference);

// Visibility scope is supplied by the existing user/assistant assignments.
export const historicalDoctors = (doctors: Doctor[], appointments: Appointment[], all: boolean, allowedIds: Set<string>): Doctor[] => {
  const catalog = new Map(doctors.map((doctor) => [doctor.id, doctor]));
  for (const appointment of appointments) {
    if (!catalog.has(appointment.doctorId) || (catalog.get(appointment.doctorId)?.nombre === "Doctor eliminado" && appointment.doctorName)) catalog.set(appointment.doctorId, {
      id: appointment.doctorId,
      nombre: appointment.doctorName ? `${appointment.doctorName} · Doctor eliminado` : 'Doctor eliminado',
      status: 'inactive', visibleEnAgenda: false, isDeletedReference: true, color: '#6B7280',
    });
  }
  return [...catalog.values()].filter((doctor) => all || allowedIds.has(doctor.id)).map((doctor) =>
    doctor.deletedAt ? { ...doctor, nombre: `${doctor.nombre} · Doctor eliminado`, status: 'inactive', isDeletedReference: true, color: '#6B7280' } : doctor,
  );
};

export const selectedDayLabel = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : `${date.getDate()} ${date.toLocaleDateString('es-MX', { month: 'long' })} ${date.getFullYear()}`;
};
