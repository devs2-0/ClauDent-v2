import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth";
import { cleanData, safeDate } from "@/shared/utils/firestoreData";
import type { Paquete } from "../types/package.types";

interface PackagesContextValue {
  paquetes: Paquete[];
  paquetesLoading: boolean;
  addPaquete: (paquete: Omit<Paquete, "id">) => Promise<void>;
  updatePaquete: (id: string, updates: Partial<Paquete>) => Promise<void>;
  deletePaquete: (id: string) => Promise<void>;
}

const PackagesContext = createContext<PackagesContextValue | undefined>(undefined);

export const PackagesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [paquetesLoading, setPaquetesLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setPaquetes([]);
      setPaquetesLoading(false);
      return;
    }

    setPaquetesLoading(true);
    return onSnapshot(query(collection(db, "paquetes"), orderBy("nombre", "asc")), (snapshot) => {
      setPaquetes(snapshot.docs.map((packageDoc) => ({
        id: packageDoc.id,
        ...packageDoc.data(),
        fechaInicio: safeDate(packageDoc.data().fechaInicio),
        fechaFin: safeDate(packageDoc.data().fechaFin),
      } as Paquete)));
      setPaquetesLoading(false);
    });
  }, [currentUser]);

  const addPaquete = async (paquete: Omit<Paquete, "id">) => {
    await addDoc(collection(db, "paquetes"), cleanData({
      ...paquete,
      fechaInicio: new Date(paquete.fechaInicio + "T00:00:00"),
      fechaFin: new Date(paquete.fechaFin + "T00:00:00"),
      fechaCreacion: new Date(),
    }));
  };

  const updatePaquete = async (id: string, updates: Partial<Paquete>) => {
    const data = { ...updates };
    if (updates.fechaInicio) data.fechaInicio = new Date(updates.fechaInicio + "T00:00:00") as any;
    if (updates.fechaFin) data.fechaFin = new Date(updates.fechaFin + "T00:00:00") as any;
    await updateDoc(doc(db, "paquetes", id), cleanData(data));
  };

  const deletePaquete = async (id: string) => {
    await deleteDoc(doc(db, "paquetes", id));
  };

  return (
    <PackagesContext.Provider value={{ paquetes, paquetesLoading, addPaquete, updatePaquete, deletePaquete }}>
      {children}
    </PackagesContext.Provider>
  );
};

export const usePackagesContext = () => {
  const context = useContext(PackagesContext);
  if (!context) throw new Error("usePackages must be used within PackagesProvider");
  return context;
};
