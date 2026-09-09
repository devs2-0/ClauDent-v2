import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth, useCan } from "@/auth";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { cleanData, safeDate } from "@/shared/utils/firestoreData";
import type { Quotation } from "../types/quotation.types";

interface QuotationsContextValue {
  quotations: Quotation[];
  quotationsLoading: boolean;
  quotationsUnavailable: boolean;
  addQuotation: (quotation: Omit<Quotation, "id">) => Promise<void>;
  updateQuotation: (id: string, quotation: Partial<Quotation>) => Promise<void>;
  deleteQuotation: (id: string) => Promise<void>;
}

const QuotationsContext = createContext<QuotationsContextValue | undefined>(undefined);

export const QuotationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { can } = useCan();
  const canRead = can("quotations.view") || can("patients.quotations.view") || can("sales.view");
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);
  const [quotationsUnavailable, setQuotationsUnavailable] = useState(false);

  useEffect(() => {
    if (!currentUser || !canRead) {
      setQuotations([]);
      setQuotationsLoading(false);
      return;
    }

    setQuotationsUnavailable(false);
    setQuotationsLoading(true);
    return onSnapshot(query(collection(db, "cotizaciones"), orderBy("fecha", "desc")), (snapshot) => {
      setQuotations(snapshot.docs.map((quotationDoc) => ({
        id: quotationDoc.id,
        ...quotationDoc.data(),
        items: Array.isArray(quotationDoc.data().items) ? quotationDoc.data().items : [],
        fecha: safeDate(quotationDoc.data().fecha),
      } as Quotation)));
      setQuotationsLoading(false);
    }, () => {
      setQuotations([]);
      setQuotationsUnavailable(true);
      setQuotationsLoading(false);
    });
  }, [currentUser, canRead]);

  const addQuotation = async (quotation: Omit<Quotation, "id">) => {
    if (!can("quotations.create")) throw new Error("No tienes permiso para realizar esta acción.");
    const ref = await addDoc(collection(db, "cotizaciones"), cleanData({ ...quotation, fecha: new Date(quotation.fecha + "T00:00:00") }));
    await addAuditLog("CREATE", "cotizaciones", `Cotizacion creada: ${quotation.pacienteId ?? ref.id} | Total: ${Number(quotation.total) || 0}`);
    toast.success("Cotizacion creada");
  };

  const updateQuotation = async (id: string, updates: Partial<Quotation>) => {
    if (!can("quotations.update")) throw new Error("No tienes permiso para realizar esta acción.");
    const data = { ...updates };
    if (updates.fecha) {
      data.fecha = new Date((typeof updates.fecha === "string" ? updates.fecha : new Date().toISOString().split("T")[0]) + "T00:00:00") as any;
    }
    await updateDoc(doc(db, "cotizaciones", id), cleanData(data));
    await addAuditLog("UPDATE", "cotizaciones", `Cotizacion actualizada: ${id}`);
  };

  const deleteQuotation = async (id: string) => {
    if (!can("quotations.delete")) throw new Error("No tienes permiso para realizar esta acción.");
    await deleteDoc(doc(db, "cotizaciones", id));
    await addAuditLog("DELETE", "cotizaciones", `Cotizacion eliminada: ${id}`);
  };

  return (
    <QuotationsContext.Provider value={{ quotations, quotationsLoading, quotationsUnavailable, addQuotation, updateQuotation, deleteQuotation }}>
      {children}
    </QuotationsContext.Provider>
  );
};

export const useQuotationsContext = () => {
  const context = useContext(QuotationsContext);
  if (!context) throw new Error("useQuotations must be used within QuotationsProvider");
  return context;
};
