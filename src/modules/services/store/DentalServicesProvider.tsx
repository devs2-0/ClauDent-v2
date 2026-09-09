import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, useCan } from "@/auth";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { cleanData } from "@/shared/utils/firestoreData";
import type { Service } from "../types/service.types";

interface DentalServicesContextValue {
  services: Service[];
  servicesLoading: boolean;
  servicesUnavailable: boolean;
  addService: (service: Omit<Service, "id">) => Promise<void>;
  updateService: (id: string, service: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
}

const DentalServicesContext = createContext<DentalServicesContextValue | undefined>(undefined);

export const DentalServicesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { can } = useCan();
  const canRead = can("services.view") || can("packages.create") || can("packages.update") || can("patients.procedures.view") || can("agenda.appointments.create") || can("agenda.appointments.update") || can("quotations.view") || can("sales.view");
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesUnavailable, setServicesUnavailable] = useState(false);

  useEffect(() => {
    if (!currentUser || !canRead) {
      setServices([]);
      setServicesLoading(false);
      return;
    }

    setServicesUnavailable(false);
    setServicesLoading(true);
    return onSnapshot(query(collection(db, "servicios")), (snapshot) => {
      setServices(snapshot.docs.map((serviceDoc) => ({ id: serviceDoc.id, ...serviceDoc.data() } as Service)));
      setServicesLoading(false);
    }, () => {
      setServices([]);
      setServicesUnavailable(true);
      setServicesLoading(false);
    });
  }, [currentUser, canRead]);

  const addService = async (service: Omit<Service, "id">) => {
    if (!can("services.create")) throw new Error("No tienes permiso para realizar esta acción.");
    await addDoc(collection(db, "servicios"), cleanData({ ...service, fechaCreacion: new Date() }));
    await addAuditLog("CREATE", "servicios", `Servicio: ${service.nombre}`);
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    if (!can("services.update")) throw new Error("No tienes permiso para realizar esta acción.");
    await updateDoc(doc(db, "servicios", id), cleanData(updates));
    await addAuditLog("UPDATE", "servicios", `Servicio actualizado: ${updates.nombre ?? id}`);
  };

  const deleteService = async (id: string) => {
    if (!can("services.delete")) throw new Error("No tienes permiso para realizar esta acción.");
    await deleteDoc(doc(db, "servicios", id));
    await addAuditLog("DELETE", "servicios", `Servicio eliminado: ${id}`);
  };

  return (
    <DentalServicesContext.Provider value={{ services, servicesLoading, servicesUnavailable, addService, updateService, deleteService }}>
      {children}
    </DentalServicesContext.Provider>
  );
};

export const useDentalServicesContext = () => {
  const context = useContext(DentalServicesContext);
  if (!context) throw new Error("useDentalServices must be used within DentalServicesProvider");
  return context;
};
