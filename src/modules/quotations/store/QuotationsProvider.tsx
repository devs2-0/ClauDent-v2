import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth";
import { cleanData, safeDate } from "@/shared/utils/firestoreData";
import type { Quotation } from "../types/quotation.types";

interface QuotationsContextValue {
  quotations: Quotation[];
  quotationsLoading: boolean;
  addQuotation: (quotation: Omit<Quotation, "id">) => Promise<void>;
  updateQuotation: (id: string, quotation: Partial<Quotation>) => Promise<void>;
  deleteQuotation: (id: string) => Promise<void>;
}

const QuotationsContext = createContext<QuotationsContextValue | undefined>(undefined);

export const QuotationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setQuotations([]);
      setQuotationsLoading(false);
      return;
    }

    setQuotationsLoading(true);
    return onSnapshot(query(collection(db, "cotizaciones"), orderBy("fecha", "desc")), (snapshot) => {
      setQuotations(snapshot.docs.map((quotationDoc) => ({
        id: quotationDoc.id,
        ...quotationDoc.data(),
        fecha: safeDate(quotationDoc.data().fecha),
      } as Quotation)));
      setQuotationsLoading(false);
    });
  }, [currentUser]);

  const addQuotation = async (quotation: Omit<Quotation, "id">) => {
    await addDoc(collection(db, "cotizaciones"), cleanData({ ...quotation, fecha: new Date(quotation.fecha + "T00:00:00") }));
    toast.success("Cotizacion creada");
  };

  const updateQuotation = async (id: string, updates: Partial<Quotation>) => {
    const data = { ...updates };
    if (updates.fecha) {
      data.fecha = new Date((typeof updates.fecha === "string" ? updates.fecha : new Date().toISOString().split("T")[0]) + "T00:00:00") as any;
    }
    await updateDoc(doc(db, "cotizaciones", id), cleanData(data));
  };

  const deleteQuotation = async (id: string) => {
    await deleteDoc(doc(db, "cotizaciones", id));
  };

  return (
    <QuotationsContext.Provider value={{ quotations, quotationsLoading, addQuotation, updateQuotation, deleteQuotation }}>
      {children}
    </QuotationsContext.Provider>
  );
};

export const useQuotationsContext = () => {
  const context = useContext(QuotationsContext);
  if (!context) throw new Error("useQuotations must be used within QuotationsProvider");
  return context;
};
