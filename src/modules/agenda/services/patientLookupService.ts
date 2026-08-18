import {
  collection,
  getDocs,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export interface PatientLookup {
  id: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  telefonoPrincipal: string;
  correo: string;
  curp?: string;
  estado: "activo" | "inactivo";
  searchText: string;
}

const patientsCollection = collection(db, "pacientes");

const toPatientLookup = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): PatientLookup => {
  const data = snapshot.data();

  const nombres = typeof data.nombres === "string" ? data.nombres : "";
  const apellidos = typeof data.apellidos === "string" ? data.apellidos : "";
  const telefonoPrincipal =
    typeof data.telefonoPrincipal === "string" ? data.telefonoPrincipal : "";
  const correo = typeof data.correo === "string" ? data.correo : "";
  const curp = typeof data.curp === "string" ? data.curp : "";

  const nombreCompleto = `${nombres} ${apellidos}`.trim();

  return {
    id: snapshot.id,
    nombres,
    apellidos,
    nombreCompleto,
    telefonoPrincipal,
    correo,
    curp,
    estado: data.estado === "inactivo" ? "inactivo" : "activo",
    searchText: [
      nombreCompleto,
      telefonoPrincipal,
      correo,
      curp,
    ].join(" "),
  };
};

export const patientLookupService = {
  listPatients: async (): Promise<PatientLookup[]> => {
    const snapshot = await getDocs(
      query(patientsCollection, orderBy("fechaRegistro", "desc")),
    );

    return snapshot.docs.map(toPatientLookup);
  },
};