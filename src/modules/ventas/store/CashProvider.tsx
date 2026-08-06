import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth";
import { cashService } from "../services/cashService";
import { cashShiftSettingsService, defaultCashShiftSettings } from "../services/cashShiftSettingsService";
import type {
  CashClosure,
  CashMovement,
  CashShiftSettings,
  CloseCashRegisterInput,
  CreateCashMovementInput,
  CreatePaymentInput,
  FinalizeQuotationCheckoutInput,
  OpenCashRegisterInput,
  Payment,
  RegisterDirectSaleInput,
} from "../types/cash.types";

interface CashContextValue {
  payments: Payment[];
  paymentsLoading: boolean;
  cashClosures: CashClosure[];
  cashClosuresLoading: boolean;
  cashMovements: CashMovement[];
  cashMovementsLoading: boolean;
  cashShiftSettings: CashShiftSettings;
  cashShiftSettingsLoading: boolean;
  openCashRegister: (input: OpenCashRegisterInput) => Promise<string>;
  createCashMovement: (input: CreateCashMovementInput) => Promise<string>;
  createPayment: (payment: CreatePaymentInput) => Promise<string>;
  cancelPayment: (id: string) => Promise<void>;
  closeCashRegister: (input: CloseCashRegisterInput) => Promise<string>;
  autoCloseCashRegister: (observaciones?: string) => Promise<string>;
  finalizeQuotationCheckout: (input: FinalizeQuotationCheckoutInput) => Promise<string>;
  registerDirectSale: (input: RegisterDirectSaleInput) => Promise<string>;
  updateCashShiftSettings: (settings: CashShiftSettings) => Promise<void>;
}

const CashContext = createContext<CashContextValue | undefined>(undefined);

export const CashProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [cashShiftSettings, setCashShiftSettings] = useState<CashShiftSettings>(defaultCashShiftSettings);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [cashClosuresLoading, setCashClosuresLoading] = useState(false);
  const [cashMovementsLoading, setCashMovementsLoading] = useState(false);
  const [cashShiftSettingsLoading, setCashShiftSettingsLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setPayments([]);
      setPaymentsLoading(false);
      return;
    }

    setPaymentsLoading(true);
    return cashService.listenPayments((nextPayments) => {
      setPayments(nextPayments);
      setPaymentsLoading(false);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setCashShiftSettings(defaultCashShiftSettings);
      setCashShiftSettingsLoading(false);
      return;
    }

    setCashShiftSettingsLoading(true);
    return cashShiftSettingsService.listenSettings((nextSettings) => {
      setCashShiftSettings(nextSettings);
      setCashShiftSettingsLoading(false);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setCashClosures([]);
      setCashClosuresLoading(false);
      return;
    }

    setCashClosuresLoading(true);
    return cashService.listenCashClosures((nextClosures) => {
      setCashClosures(nextClosures);
      setCashClosuresLoading(false);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setCashMovements([]);
      setCashMovementsLoading(false);
      return;
    }

    setCashMovementsLoading(true);
    return cashService.listenCashMovements((nextMovements) => {
      setCashMovements(nextMovements);
      setCashMovementsLoading(false);
    });
  }, [currentUser]);

  const openCashRegister = useCallback(async (input: OpenCashRegisterInput) => {
    const id = await cashService.openCashRegister(input);
    toast.success("Caja abierta");
    return id;
  }, []);

  const createCashMovement = useCallback(async (input: CreateCashMovementInput) => {
    const id = await cashService.createCashMovement(input);
    toast.success("Movimiento registrado en caja");
    return id;
  }, []);

  const createPayment = useCallback(async (payment: CreatePaymentInput) => {
    const id = await cashService.createPayment(payment);
    toast.success("Pago registrado en caja");
    return id;
  }, []);

  const cancelPayment = useCallback(async (id: string) => {
    await cashService.cancelPayment(id);
    toast.success("Pago cancelado");
  }, []);

  const closeCashRegister = useCallback(async (input: CloseCashRegisterInput) => {
    const id = await cashService.closeCashRegister(input);
    toast.success("Corte de caja cerrado");
    return id;
  }, []);

  const autoCloseCashRegister = useCallback(async (observaciones?: string) => {
    const id = await cashService.autoCloseCashRegister(observaciones);
    toast.success("Corte automatico cerrado");
    return id;
  }, []);

  const finalizeQuotationCheckout = useCallback(async (input: FinalizeQuotationCheckoutInput) => {
    const id = await cashService.finalizeQuotationCheckout(input);
    toast.success("Cotizacion cobrada y registrada en caja");
    return id;
  }, []);

  const registerDirectSale = useCallback(async (input: RegisterDirectSaleInput) => {
    const id = await cashService.registerDirectSale(input);
    toast.success("Venta registrada en caja");
    return id;
  }, []);

  const updateCashShiftSettings = useCallback(async (settings: CashShiftSettings) => {
    await cashShiftSettingsService.updateSettings(settings);
    toast.success("Configuracion de turnos guardada");
  }, []);

  return (
    <CashContext.Provider
      value={{
        payments,
        paymentsLoading,
        cashClosures,
        cashClosuresLoading,
        cashMovements,
        cashMovementsLoading,
        cashShiftSettings,
        cashShiftSettingsLoading,
        openCashRegister,
        createCashMovement,
        createPayment,
        cancelPayment,
        closeCashRegister,
        autoCloseCashRegister,
        finalizeQuotationCheckout,
        registerDirectSale,
        updateCashShiftSettings,
      }}
    >
      {children}
    </CashContext.Provider>
  );
};

export const useCashContext = () => {
  const context = useContext(CashContext);
  if (!context) throw new Error("useCashRegister must be used within CashProvider");
  return context;
};
