import { useEffect, useMemo, useState } from "react";
import {
  collection,
  documentId,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { useCan } from "@/auth";
import { safeLocalDate } from "@/shared/utils/firestoreData";
import { parseLocalDate } from "@/shared/utils/duration";
import { latestProcedureDate } from "../utils/patientAlerts";
import { db } from "@/lib/firebase";

export const usePatientClinicalActivity = (patientIds: string[]) => {
  const { can } = useCan();
  const canReadHistory = can("patients.procedures.view");
  const canReadAppointments = can("agenda.view");
  const canReadClinicalHistory = can("patients.clinicalHistory.view");
  const patientIdsKey = JSON.stringify([...patientIds].sort());
  const [historyKey, setHistoryKey] = useState("");
  const [consultationsKey, setConsultationsKey] = useState("");
  const [historyActivity, setHistoryActivity] = useState<Map<string, string>>(new Map());
  const [appointmentActivity, setAppointmentActivity] = useState<Map<string, string>>(new Map());
  const [consultationActivity, setConsultationActivity] = useState<Map<string, string>>(new Map());
  const [consultationsSettled, setConsultationsSettled] = useState(false);
  const [consultationsUnavailable, setConsultationsUnavailable] = useState(false);

  useEffect(() => {
    setConsultationsKey(patientIdsKey);
    setConsultationActivity(new Map());
    setConsultationsUnavailable(!canReadClinicalHistory);
    const ids: string[] = JSON.parse(patientIdsKey);
    setConsultationsSettled(!canReadClinicalHistory || ids.length === 0);
    if (!canReadClinicalHistory) return;
    const pending = new Set(ids);
    const settled = (patientId: string) => { pending.delete(patientId); setConsultationsSettled(pending.size === 0); };
    const unsubscribe = ids.map((patientId) => onSnapshot(
      query(collection(db, "pacientes", patientId, "historia_clinica"), where(documentId(), 'in', ['historiaGeneral', 'datos_generales'])),
      (snapshot) => {
        const latest = snapshot.docs.filter((item) => ['historiaGeneral', 'datos_generales'].includes(item.id))
          .map((item) => safeLocalDate(item.data().fecha_ult_consulta_odontologica))
          .filter((date) => { const parsed = parseLocalDate(date); return parsed && parsed <= new Date(); })
          .sort().pop();
        setConsultationActivity((current) => {
          const next = new Map(current);
          if (latest) next.set(patientId, latest); else next.delete(patientId);
          return next;
        });
        settled(patientId);
      },
      () => { setConsultationsUnavailable(true); settled(patientId); },
    ));
    return () => unsubscribe.forEach((stop) => stop());
  }, [patientIdsKey, canReadClinicalHistory]);
  const [historySettled, setHistorySettled] = useState(false);
  const [appointmentsSettled, setAppointmentsSettled] = useState(false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [appointmentsUnavailable, setAppointmentsUnavailable] = useState(false);

  useEffect(() => {
    setHistoryKey(patientIdsKey);
    setHistoryActivity(new Map());
    setHistoryUnavailable(!canReadHistory);
    const ids: string[] = JSON.parse(patientIdsKey);
    setHistorySettled(!canReadHistory || ids.length === 0);
    if (!canReadHistory) return;
    const pending = new Set(ids);
    const settled = (patientId: string) => { pending.delete(patientId); setHistorySettled(pending.size === 0); };
    const unsubscribe = ids.map((patientId) => onSnapshot(
      collection(db, "pacientes", patientId, "historial"),
      (snapshot) => {
        const latest = latestProcedureDate(snapshot.docs.map((item) => item.data()), new Date());
        setHistoryActivity((current) => {
          const next = new Map(current);
          if (latest) next.set(patientId, latest); else next.delete(patientId);
          return next;
        });
        settled(patientId);
      },
      () => { setHistoryUnavailable(true); settled(patientId); },
    ));
    return () => unsubscribe.forEach((stop) => stop());
  }, [patientIdsKey, canReadHistory]);

  useEffect(() => {
    setAppointmentActivity(new Map());
    setAppointmentsUnavailable(!canReadAppointments);
    setAppointmentsSettled(!canReadAppointments);
    if (!canReadAppointments) return;
    const completedAppointmentsQuery = query(
      collection(db, "citas"),
      where("status", "==", "completed"),
    );
    const unsubscribeAppointments = onSnapshot(
      completedAppointmentsQuery,
      (snapshot) => {
        const nextActivity = new Map<string, string>();

        snapshot.docs.forEach((appointmentDocument) => {
          const appointment = appointmentDocument.data();
          const patientId = appointment.patientId;
          const activityDate = safeLocalDate(appointment.startDate);
          const parsed = parseLocalDate(activityDate);
          if (!parsed || parsed > new Date()) return;
          if (typeof patientId === "string" && patientId) {
            const currentDate = nextActivity.get(patientId) ?? "";
            if (!nextActivity.has(patientId) || activityDate > currentDate) {
              nextActivity.set(patientId, activityDate);
            }
          }
        });

        setAppointmentActivity(nextActivity);
        setAppointmentsUnavailable(false);
        setAppointmentsSettled(true);
      },
      () => {
        setAppointmentsUnavailable(true);
        setAppointmentsSettled(true);
      },
    );

    return () => {
      unsubscribeAppointments();
    };
  }, [canReadAppointments]);

  const lastClinicalActivityByPatient = useMemo(() => {
    const combinedActivity = new Map(historyActivity);

    for (const source of [appointmentActivity, consultationActivity]) {
      source.forEach((activityDate, patientId) => {
        if (activityDate > (combinedActivity.get(patientId) ?? "")) combinedActivity.set(patientId, activityDate);
      });
    }

    return combinedActivity;
  }, [appointmentActivity, historyActivity, consultationActivity]);

  const patientIdsWithClinicalActivity = useMemo(
    () => new Set(lastClinicalActivityByPatient.keys()),
    [lastClinicalActivityByPatient],
  );

  return {
    historyActivityByPatient: canReadHistory ? historyActivity : new Map<string, string>(),
    appointmentActivityByPatient: canReadAppointments ? appointmentActivity : new Map<string, string>(),
    consultationActivityByPatient: canReadClinicalHistory ? consultationActivity : new Map<string, string>(),
    patientIdsWithClinicalActivity,
    lastClinicalActivityByPatient,
    clinicalActivityLoading: historyKey !== patientIdsKey || consultationsKey !== patientIdsKey || !historySettled || !appointmentsSettled || !consultationsSettled,
    clinicalActivityUnavailable: historyUnavailable || appointmentsUnavailable || consultationsUnavailable,
  };
};
