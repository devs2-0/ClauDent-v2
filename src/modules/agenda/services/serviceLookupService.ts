import {
  collection,
  getDocs,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export interface ServiceLookup {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  estado: "activo" | "inactivo";
  searchText: string;
}

const servicesCollection = collection(db, "servicios");

const toServiceLookup = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): ServiceLookup => {
  const data = snapshot.data();

  const codigo = typeof data.codigo === "string" ? data.codigo : "";
  const nombre = typeof data.nombre === "string" ? data.nombre : "";
  const descripcion =
    typeof data.descripcion === "string" ? data.descripcion : "";
  const categoria = typeof data.categoria === "string" ? data.categoria : "";
  const precio = typeof data.precio === "number" ? data.precio : 0;

  return {
    id: snapshot.id,
    codigo,
    nombre,
    descripcion,
    precio,
    categoria,
    estado: data.estado === "inactivo" ? "inactivo" : "activo",
    searchText: [
      codigo,
      nombre,
      descripcion,
      categoria,
      precio.toString(),
    ].join(" "),
  };
};

export const serviceLookupService = {
  listServices: async (): Promise<ServiceLookup[]> => {
    const snapshot = await getDocs(
      query(servicesCollection, orderBy("nombre")),
    );

    return snapshot.docs.map(toServiceLookup);
  },
};