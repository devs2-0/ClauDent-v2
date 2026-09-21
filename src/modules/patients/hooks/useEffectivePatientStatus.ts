import { useEffect, useMemo, useState } from 'react';
import { useCan } from '@/auth';
import type { Patient } from '../types/patient.types';
import { patientReviewDue } from '../utils/patientAlerts';
import { usePatientInactivitySettings } from './usePatientInactivitySettings';
import { usePatientClinicalActivity } from './usePatientClinicalActivity';

export const useEffectivePatientStatus = (patients: Patient[]) => {
  const { can } = useCan();
  const { automatic } = usePatientInactivitySettings();
  const [today, setToday] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setToday(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  const candidateIds = useMemo(() => patients.filter((patient) => patient.estado === 'activo' && (!patient.fechaRegistro || patientReviewDue(patient, automatic, today))).map((patient) => patient.id), [patients, automatic, today]);
  const activity = usePatientClinicalActivity(candidateIds);
  // Do not infer inactivity while clinical data is partial or permissions hide a source.
  const complete = can('patients.procedures.view') && can('patients.clinicalHistory.view') && can('agenda.view') && !activity.clinicalActivityLoading && !activity.clinicalActivityUnavailable;
  return patients.map((patient) => complete && patient.estado === 'activo' && patientReviewDue(patient, automatic, today, activity.historyActivityByPatient.get(patient.id), activity.appointmentActivityByPatient.get(patient.id), activity.consultationActivityByPatient.get(patient.id))
    ? { ...patient, estado: 'inactivo' as const, automaticInactivity: true }
    : { ...patient, automaticInactivity: false });
};
