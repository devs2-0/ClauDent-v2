export { useCashRegister } from "./hooks/useCashRegister";
export { default as CajaPage } from "./pages/CajaPage";
export { default as VentasPage } from "./pages/VentasPage";
export { cashService } from "./services/cashService";
export { accountsReceivableService } from "./services/accountsReceivableService";
export { CashProvider } from "./store/CashProvider";

export type {
  CashClosure,
  CashClosureTotals,
  CashShiftDefinition,
  CashShiftSettings,
  CashShiftMode,
  CheckoutInventoryItem,
  CloseCashRegisterInput,
  CreatePaymentInput,
  DirectSaleProductItem,
  DirectSaleServiceItem,
  FinalizeQuotationCheckoutInput,
  Payment,
  PaymentMethod,
  PaymentOrigin,
  PaymentStatus,
  RegisterDirectSaleInput,
  RegisterDirectSaleWithReceivableResult,
} from "./types/cash.types";

export type {
  AccountReceivable,
  AccountsReceivableStatus,
  CreateAccountReceivableInput,
  RegisterInstallmentInput,
} from "./types/accountsReceivable.types";
