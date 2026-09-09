import { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export const usePatientClinicalActivity = () => {
  const [historyActivity, setHistoryActivity] = useState<Map<string, string>>(new Map());
  const [appointmentActivity, setAppointmentActivity] = useState<Map<string, string>>(new Map());
  const [historySettled, setHistorySettled] = useState(false);
  const [appointmentsSettled, setAppointmentsSettled] = useState(false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [appointmentsUnavailable, setAppointmentsUnavailable] = useState(false);

  useEffect(() => {
    const unsubscribeHistory = onSnapshot(
      collectionGroup(db, "historial"),
      (snapshot) => {
        const nextActivity = new Map<string, string>();

        snapshot.docs.forEach((historyDocument) => {
          const patientDocument = historyDocument.ref.parent.parent;
          if (patientDocument?.parent.id === "pacientes") {
            const rawDate = historyDocument.data().fecha;
            const activityDate = rawDate?.toDate
              ? rawDate.toDate().toISOString().slice(0, 10)
              : typeof rawDate === "string"
                ? rawDate.slice(0, 10)
                : "";
            const currentDate = nextActivity.get(patientDocument.id) ?? "";

            if (!nextActivity.has(patientDocument.id) || activityDate > currentDate) {
              nextActivity.set(patientDocument.id, activityDate);
            }
          }
        });

        setHistoryActivity(nextActivity);
        setHistoryUnavailable(false);
        setHistorySettled(true);
      },
      () => {
        setHistoryUnavailable(true);
        setHistorySettled(true);
      },
    );

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
          const activityDate =
            typeof appointment.startDate === "string"
              ? appointment.startDate.slice(0, 10)
              : "";
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
      unsubscribeHistory();
      unsubscribeAppointments();
    };
  }, []);

  const lastClinicalActivityByPatient = useMemo(() => {
    const combinedActivity = new Map(historyActivity);

    appointmentActivity.forEach((activityDate, patientId) => {
      if (activityDate > (combinedActivity.get(patientId) ?? "")) {
        combinedActivity.set(patientId, activityDate);
      }
    });

    return combinedActivity;
  }, [appointmentActivity, historyActivity]);

  const patientIdsWithClinicalActivity = useMemo(
    () => new Set(lastClinicalActivityByPatient.keys()),
    [lastClinicalActivityByPatient],
  );

  return {
    patientIdsWithClinicalActivity,
    lastClinicalActivityByPatient,
    clinicalActivityLoading: !historySettled || !appointmentsSettled,
    clinicalActivityUnavailable: historyUnavailable || appointmentsUnavailable,
  };
};
