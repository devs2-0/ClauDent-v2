import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, useCan } from "@/auth";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { cleanData, safeDate } from "@/shared/utils/firestoreData";
import type { Paquete } from "../types/package.types";

interface PackagesContextValue {
  paquetes: Paquete[];
  paquetesLoading: boolean;
  paquetesUnavailable: boolean;
  addPaquete: (paquete: Omit<Paquete, "id">) => Promise<void>;
  updatePaquete: (id: string, updates: Partial<Paquete>) => Promise<void>;
  deletePaquete: (id: string) => Promise<void>;
}

const PackagesContext = createContext<PackagesContextValue | undefined>(undefined);

export const PackagesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { can } = useCan();
  const canRead = can("packages.view") || can("quotations.view") || can("sales.view");
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [paquetesLoading, setPaquetesLoading] = useState(false);
  const [paquetesUnavailable, setPaquetesUnavailable] = useState(false);

  useEffect(() => {
    if (!currentUser || !canRead) {
      setPaquetes([]);
      setPaquetesLoading(false);
      return;
    }

    setPaquetesUnavailable(false);
    setPaquetesLoading(true);
    return onSnapshot(query(collection(db, "paquetes"), orderBy("nombre", "asc")), (snapshot) => {
      setPaquetes(snapshot.docs.map((packageDoc) => ({
        id: packageDoc.id,
        ...packageDoc.data(),
        serviciosIncluidos: Array.isArray(packageDoc.data().serviciosIncluidos) ? packageDoc.data().serviciosIncluidos : [],
        fechaInicio: safeDate(packageDoc.data().fechaInicio),
        fechaFin: safeDate(packageDoc.data().fechaFin),
      } as Paquete)));
      setPaquetesLoading(false);
    }, () => {
      setPaquetes([]);
      setPaquetesUnavailable(true);
      setPaquetesLoading(false);
    });
  }, [currentUser, canRead]);

  const addPaquete = async (paquete: Omit<Paquete, "id">) => {
    if (!can("packages.create")) throw new Error("No tienes permiso para realizar esta acción.");
    const ref = await addDoc(collection(db, "paquetes"), cleanData({
      ...paquete,
      fechaInicio: new Date(paquete.fechaInicio + "T00:00:00"),
      fechaFin: new Date(paquete.fechaFin + "T00:00:00"),
      fechaCreacion: new Date(),
    }));
    await addAuditLog("CREATE", "paquetes", `Paquete creado: ${paquete.nombre ?? ref.id}`);
  };

  const updatePaquete = async (id: string, updates: Partial<Paquete>) => {
    if (!can("packages.update")) throw new Error("No tienes permiso para realizar esta acción.");
    const data = { ...updates };
    if (updates.fechaInicio) data.fechaInicio = new Date(updates.fechaInicio + "T00:00:00") as any;
    if (updates.fechaFin) data.fechaFin = new Date(updates.fechaFin + "T00:00:00") as any;
    await updateDoc(doc(db, "paquetes", id), cleanData(data));
    await addAuditLog("UPDATE", "paquetes", `Paquete actualizado: ${updates.nombre ?? id}`);
  };

  const deletePaquete = async (id: string) => {
    if (!can("packages.delete")) throw new Error("No tienes permiso para realizar esta acción.");
    await deleteDoc(doc(db, "paquetes", id));
    await addAuditLog("DELETE", "paquetes", `Paquete eliminado: ${id}`);
  };

  return (
    <PackagesContext.Provider value={{ paquetes, paquetesLoading, paquetesUnavailable, addPaquete, updatePaquete, deletePaquete }}>
      {children}
    </PackagesContext.Provider>
  );
};

export const usePackagesContext = () => {
  const context = useContext(PackagesContext);
  if (!context) throw new Error("usePackages must be used within PackagesProvider");
  return context;
};
