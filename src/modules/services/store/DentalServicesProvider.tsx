import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { cleanData } from "@/shared/utils/firestoreData";
import type { Service } from "../types/service.types";

interface DentalServicesContextValue {
  services: Service[];
  servicesLoading: boolean;
  addService: (service: Omit<Service, "id">) => Promise<void>;
  updateService: (id: string, service: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
}

const DentalServicesContext = createContext<DentalServicesContextValue | undefined>(undefined);

export const DentalServicesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setServices([]);
      setServicesLoading(false);
      return;
    }

    setServicesLoading(true);
    return onSnapshot(query(collection(db, "servicios")), (snapshot) => {
      setServices(snapshot.docs.map((serviceDoc) => ({ id: serviceDoc.id, ...serviceDoc.data() } as Service)));
      setServicesLoading(false);
    });
  }, [currentUser]);

  const addService = async (service: Omit<Service, "id">) => {
    await addDoc(collection(db, "servicios"), cleanData({ ...service, fechaCreacion: new Date() }));
    await addAuditLog("CREATE", "servicios", `Servicio: ${service.nombre}`);
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    await updateDoc(doc(db, "servicios", id), cleanData(updates));
  };

  const deleteService = async (id: string) => {
    await deleteDoc(doc(db, "servicios", id));
  };

  return (
    <DentalServicesContext.Provider value={{ services, servicesLoading, addService, updateService, deleteService }}>
      {children}
    </DentalServicesContext.Provider>
  );
};

export const useDentalServicesContext = () => {
  const context = useContext(DentalServicesContext);
  if (!context) throw new Error("useDentalServices must be used within DentalServicesProvider");
  return context;
};
