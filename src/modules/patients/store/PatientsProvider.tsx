import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { cleanData, safeDate } from "@/shared/utils/firestoreData";
import type { Patient } from "../types/patient.types";
import type { HistoryEntry, IHistoriaClinicaCompleta } from "../types/clinicalHistory.types";

interface PatientsContextValue {
  patients: Patient[];
  patientsLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addPatient: (patient: Omit<Patient, "id" | "fechaRegistro">) => Promise<string>;
  updatePatient: (id: string, patient: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  addHistoryEntry: (patientId: string, entry: Omit<HistoryEntry, "id">) => Promise<void>;
  updateHistoryEntry: (patientId: string, entryId: string, updates: Partial<HistoryEntry>) => Promise<void>;
  deleteHistoryEntry: (patientId: string, entryId: string) => Promise<void>;
  addOdontogram: (patientId: string, tipo: "adulto" | "niño" | "mixto", nombre?: string) => Promise<void>;
  updateOdontogramName: (patientId: string, odontogramId: string, newName: string) => Promise<void>;
  deleteOdontogram: (patientId: string, odontogramId: string) => Promise<void>;
  addInitialHistoryForms: (patientId: string, forms: IHistoriaClinicaCompleta) => Promise<void>;
}

const PatientsContext = createContext<PatientsContextValue | undefined>(undefined);

export const PatientsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!currentUser) {
      setPatients([]);
      setPatientsLoading(false);
      return;
    }

    setPatientsLoading(true);
    const patientsQuery = query(collection(db, "pacientes"), orderBy("fechaRegistro", "desc"));

    return onSnapshot(patientsQuery, (snapshot) => {
      setPatients(snapshot.docs.map((patientDoc) => ({
        id: patientDoc.id,
        ...patientDoc.data(),
        fechaRegistro: safeDate(patientDoc.data().fechaRegistro),
      } as Patient)));
      setPatientsLoading(false);
    });
  }, [currentUser]);

  const addPatient = async (patient: Omit<Patient, "id" | "fechaRegistro">) => {
    const id = (await addDoc(collection(db, "pacientes"), cleanData({ ...patient, fechaRegistro: new Date() }))).id;
    await addAuditLog("CREATE", "pacientes", `Paciente registrado: ${patient.nombres}`);
    return id;
  };

  const updatePatient = async (id: string, updates: Partial<Patient>) => {
    await updateDoc(doc(db, "pacientes", id), cleanData(updates));
    await addAuditLog("UPDATE", "pacientes", `ID: ${id}`);
  };

  const deletePatient = async (id: string) => {
    await deleteDoc(doc(db, "pacientes", id));
    await addAuditLog("DELETE", "pacientes", `ID: ${id}`);
  };

  const addHistoryEntry = async (patientId: string, entry: Omit<HistoryEntry, "id">) => {
    await addDoc(collection(db, "pacientes", patientId, "historial"), cleanData({ ...entry, fecha: new Date(entry.fecha + "T00:00:00") }));
    toast.success("Historial agregado");
  };

  const updateHistoryEntry = async (patientId: string, entryId: string, updates: Partial<HistoryEntry>) => {
    const data = { ...updates };
    if (updates.fecha) data.fecha = new Date(updates.fecha + "T00:00:00") as any;
    await updateDoc(doc(db, "pacientes", patientId, "historial", entryId), cleanData(data));
  };

  const deleteHistoryEntry = async (patientId: string, entryId: string) => {
    await deleteDoc(doc(db, "pacientes", patientId, "historial", entryId));
  };

  const addOdontogram = async (patientId: string, tipo: "adulto" | "niño" | "mixto", nombre?: string) => {
    await addDoc(collection(db, "pacientes", patientId, "odontograma"), {
      fecha: new Date(),
      tipo,
      nombre: nombre || (tipo === "mixto" ? "Odontograma Mixto" : `Odontograma ${tipo}`),
      dientes: {},
      notas: "",
    });
    await addAuditLog("CREATE", "odontograma", `Nuevo odontograma - Paciente: ${patientId}`);
  };

  const updateOdontogramName = async (patientId: string, odontogramId: string, newName: string) => {
    await updateDoc(doc(db, "pacientes", patientId, "odontograma", odontogramId), { nombre: newName });
  };

  const deleteOdontogram = async (patientId: string, odontogramId: string) => {
    await deleteDoc(doc(db, "pacientes", patientId, "odontograma", odontogramId));
  };

  const addInitialHistoryForms = async (patientId: string, forms: IHistoriaClinicaCompleta) => {
    const batch = writeBatch(db);
    const path = `pacientes/${patientId}/historia_clinica`;

    batch.set(doc(db, path, "historiaGeneral"), cleanData(forms.historiaGeneral));
    batch.set(doc(db, path, "antecedentesHereditarios"), cleanData(forms.antecedentesHereditarios));
    batch.set(doc(db, path, "appPatologicos"), cleanData(forms.appPatologicos));
    batch.set(doc(db, path, "apnp"), cleanData(forms.apnp));
    batch.set(doc(db, path, "alergias"), cleanData(forms.alergias));
    batch.set(doc(db, path, "hospitalizaciones"), cleanData(forms.hospitalizaciones));
    batch.set(doc(db, path, "signosVitales"), cleanData(forms.signosVitales));
    batch.set(doc(db, path, "exploracionCabezaCuello"), cleanData(forms.exploracionCabezaCuello));
    batch.set(doc(db, path, "exploracionAtm"), cleanData(forms.exploracionAtm));
    batch.set(doc(db, path, "cavidadOral"), cleanData(forms.cavidadOral));
    batch.set(doc(db, `pacientes/${patientId}`), { hasHistorial: true }, { merge: true });

    await batch.commit();
    toast.success("Historia clinica guardada");
  };

  return (
    <PatientsContext.Provider
      value={{
        patients,
        patientsLoading,
        searchQuery,
        setSearchQuery,
        addPatient,
        updatePatient,
        deletePatient,
        addHistoryEntry,
        updateHistoryEntry,
        deleteHistoryEntry,
        addOdontogram,
        updateOdontogramName,
        deleteOdontogram,
        addInitialHistoryForms,
      }}
    >
      {children}
    </PatientsContext.Provider>
  );
};

export const usePatientsContext = () => {
  const context = useContext(PatientsContext);
  if (!context) throw new Error("usePatients must be used within PatientsProvider");
  return context;
};
