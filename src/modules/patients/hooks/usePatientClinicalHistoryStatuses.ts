import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { useCan } from "@/auth";
import { db } from "@/lib/firebase";
import type { Patient } from "@/modules/patients";
import {
  getClinicalHistoryStatus,
  hasCompletedInitialHistory,
  type ClinicalHistorySections,
  type ClinicalHistoryStatus,
} from "@/modules/patients/utils/patientUi";

const supportedSections = new Set<keyof ClinicalHistorySections>([
  "historiaGeneral",
  "antecedentesHereditarios",
  "appPatologicos",
  "apnp",
  "alergias",
  "hospitalizaciones",
]);

export const usePatientClinicalHistoryStatuses = (visiblePatients: Patient[]) => {
  const { can } = useCan();
  const canReadHistory = can("patients.clinicalHistory.view");
  const [statuses, setStatuses] = useState<Map<string, ClinicalHistoryStatus>>(new Map());
  const [loading, setLoading] = useState(false);
  const visiblePatientsKey = useMemo(
    () => visiblePatients
      .map((patient) => `${patient.id}:${hasCompletedInitialHistory(patient) ? "1" : "0"}`)
      .join("|"),
    [visiblePatients],
  );

  useEffect(() => {
    let cancelled = false;

    if (!canReadHistory || visiblePatients.length === 0) {
      setStatuses(new Map());
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    void Promise.all(visiblePatients.map(async (patient) => {
      try {
        const snapshot = await getDocs(
          collection(db, "pacientes", patient.id, "historia_clinica"),
        );
        const sections: ClinicalHistorySections = {};

        snapshot.docs.forEach((historyDocument) => {
          const sectionName = historyDocument.id as keyof ClinicalHistorySections;
          if (supportedSections.has(sectionName)) {
            sections[sectionName] = historyDocument.data();
          }
        });

        return [patient.id, getClinicalHistoryStatus(sections)] as const;
      } catch {
        return [
          patient.id,
          hasCompletedInitialHistory(patient) ? "incomplete" : "none",
        ] as const;
      }
    })).then((entries) => {
      if (!cancelled) setStatuses(new Map(entries));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  // The key intentionally refreshes statuses when visible IDs or their saved-history flag changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePatientsKey, canReadHistory]);

  return { clinicalHistoryStatuses: statuses, clinicalHistoryStatusesLoading: loading };
};
