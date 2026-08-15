import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  Download,
  FileText,
  HandCoins,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import {
  accountsReceivableService,
  useCashRegister,
  type AccountReceivable,
  type Payment,
  type PaymentMethod,
  type PaymentOrigin,
} from "@/modules/ventas";
import { generateSaleReceiptPDF, type SaleReceiptKind } from "@/modules/ventas/services/saleReceiptPdfService";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn, formatCurrency } from "@/shared/utils/utils";

interface PatientPaymentsProps {
  patientId: string;
  patientName: string;
}

type AccountFormState = {
  concepto: string;
  total: string;
  abonoInicial: string;
  metodo: PaymentMethod;
  fecha: string;
  fechaVencimiento: string;
  alertaDiasSinAbono: string;
  notas: string;
};

type InstallmentFormState = {
  monto: string;
  metodo: PaymentMethod;
  fecha: string;
  notas: string;
};

const methodLabel: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const originLabel: Record<PaymentOrigin, string> = {
  cotizacion: "Cotizacion",
  venta_directa: "Venta directa",
  abono: "Abono",
};

const statusLabel: Record<AccountReceivable["estado"], string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const createDefaultAccountForm = (): AccountFormState => ({
  concepto: "",
  total: "",
  abonoInicial: "",
  metodo: "efectivo",
  fecha: todayKey(),
  fechaVencimiento: "",
  alertaDiasSinAbono: "15",
  notas: "",
});

const createDefaultInstallmentForm = (): InstallmentFormState => ({
  monto: "",
  metodo: "efectivo",
  fecha: todayKey(),
  notas: "",
});

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Sin fecha";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const paymentSearchLabel = (payment: Payment) => {
  if (payment.tipoIngreso === "tratamiento") return "Tratamiento";
  if (payment.tipoIngreso === "venta_productos") return "Productos";
  if (payment.tipoIngreso === "venta_mixta") return "Tratamiento y productos";
  if (payment.tipoIngreso === "abono") return "Abono";
  return originLabel[payment.origen] ?? "Pago";
};

const getReceiptKind = (payment: Payment): SaleReceiptKind => {
  if (payment.tipoIngreso === "tratamiento") return "tratamiento";
  if (payment.tipoIngreso === "venta_mixta") return "mixto";
  if (payment.tipoIngreso === "abono") return "abono";
  if (payment.tipoIngreso === "venta_productos") return "venta";
  return "pago";
};

const getCurrentTime = () => new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const parseMoneyInput = (value: string) => Number(value || 0);

const PaymentSummaryCard = ({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  tone?: "default" | "warning";
}) => (
  <Card>
    <CardContent className="flex items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={cn("mt-1 text-2xl font-semibold", tone === "warning" && "text-amber-700")}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary",
          tone === "warning" && "bg-amber-100 text-amber-700",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
    </CardContent>
  </Card>
);

const PatientPayments: React.FC<PatientPaymentsProps> = ({ patientId, patientName }) => {
  const { payments, paymentsLoading } = useCashRegister();
  const [accounts, setAccounts] = useState<AccountReceivable[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountReceivable | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const isSavingAccountRef = useRef(false);
  const [accountForm, setAccountForm] = useState<AccountFormState>(() => createDefaultAccountForm());
  const [installmentForm, setInstallmentForm] = useState<InstallmentFormState>(() => createDefaultInstallmentForm());

  useEffect(() => {
    setAccountsLoading(true);
    const unsubscribe = accountsReceivableService.listenPatientAccounts(patientId, (nextAccounts) => {
      setAccounts(nextAccounts);
      setAccountsLoading(false);
    });

    return unsubscribe;
  }, [patientId]);

  const patientPayments = useMemo(() => {
    const normalizedPatientName = normalizeName(patientName);

    return payments
      .filter((payment) => {
        if (payment.pacienteId === patientId) return true;
        return !payment.pacienteId && normalizedPatientName && normalizeName(payment.pacienteNombre) === normalizedPatientName;
      })
      .sort((a, b) => new Date(`${b.fecha}T00:00:00`).getTime() - new Date(`${a.fecha}T00:00:00`).getTime());
  }, [patientId, patientName, payments]);

  const patientAccounts = accounts;

  const activePayments = patientPayments.filter((payment) => payment.estado === "activo");
  const canceledPayments = patientPayments.filter((payment) => payment.estado === "cancelado");
  const pendingAccounts = patientAccounts.filter((account) => account.saldoPendiente > 0 && account.estado !== "cancelada");
  const overdueAccounts = pendingAccounts.filter((account) => account.estado === "vencida");
  const totalReceivableBalance = pendingAccounts.reduce((total, account) => total + account.saldoPendiente, 0);
  const totalPaid = activePayments.reduce((total, payment) => total + payment.monto, 0);
  const treatmentPaid = activePayments
    .filter((payment) => payment.tipoIngreso === "tratamiento" || payment.tipoIngreso === "venta_mixta" || payment.tipoIngreso === "abono")
    .reduce((total, payment) => total + payment.monto, 0);
  const lastPayment = activePayments[0];

  const resetAccountDialog = () => {
    setAccountForm(createDefaultAccountForm());
    setIsAccountDialogOpen(false);
  };

  const resetInstallmentDialog = () => {
    setSelectedAccount(null);
    setInstallmentForm(createDefaultInstallmentForm());
  };

  const handleDownloadReceipt = (payment: Payment) => {
    generateSaleReceiptPDF({
      paymentId: payment.id,
      fecha: payment.fecha,
      hora: getCurrentTime(),
      pacienteNombre: payment.pacienteNombre || patientName,
      metodo: payment.metodo,
      lineItems: [
        {
          tipo: paymentSearchLabel(payment),
          concepto: payment.concepto || paymentSearchLabel(payment),
          cantidad: 1,
          precioUnitario: payment.monto,
        },
      ],
      subtotalServicios:
        payment.tipoIngreso === "tratamiento" || payment.tipoIngreso === "venta_mixta" || payment.tipoIngreso === "abono"
          ? payment.monto
          : 0,
      subtotalProductos: payment.tipoIngreso === "venta_productos" ? payment.monto : 0,
      descuento: 0,
      total: payment.monto,
      tipoRecibo: getReceiptKind(payment),
      tipoIngreso: payment.tipoIngreso ?? null,
      notas: payment.notas,
    });
    toast.success("Recibo PDF generado");
  };

  const handleCreateAccount = async () => {
    if (isSavingAccountRef.current) return;
    const total = parseMoneyInput(accountForm.total);
    const abonoInicial = parseMoneyInput(accountForm.abonoInicial);

    if (!accountForm.concepto.trim()) {
      toast.error("Captura el concepto del tratamiento.");
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Captura un total valido.");
      return;
    }
    if (!Number.isFinite(abonoInicial) || abonoInicial < 0 || abonoInicial > total) {
      toast.error("El abono inicial no puede ser negativo ni mayor al total.");
      return;
    }

    isSavingAccountRef.current = true;
    setIsSavingAccount(true);
    try {
      await accountsReceivableService.createAccount({
        pacienteId,
        pacienteNombre: patientName,
        concepto: accountForm.concepto.trim(),
        total,
        abonoInicial,
        metodo: accountForm.metodo,
        fecha: accountForm.fecha,
        fechaVencimiento: accountForm.fechaVencimiento || null,
        alertaDiasSinAbono: Number(accountForm.alertaDiasSinAbono) || 15,
        notas: accountForm.notas.trim(),
        notasAbono: abonoInicial > 0 ? "Abono inicial" : "",
      });
      toast.success(abonoInicial > 0 ? "Cuenta y abono inicial registrados" : "Cuenta por cobrar creada");
      resetAccountDialog();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo crear la cuenta por cobrar.");
    } finally {
      isSavingAccountRef.current = false;
      setIsSavingAccount(false);
    }
  };

  const handleRegisterInstallment = async () => {
    if (isSavingAccountRef.current) return;
    if (!selectedAccount) return;
    const amount = parseMoneyInput(installmentForm.monto);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Captura un abono valido.");
      return;
    }
    if (amount > selectedAccount.saldoPendiente) {
      toast.error("El abono no puede exceder el saldo pendiente.");
      return;
    }

    isSavingAccountRef.current = true;
    setIsSavingAccount(true);
    try {
      await accountsReceivableService.registerInstallment({
        cuentaPorCobrarId: selectedAccount.id,
        monto: amount,
        metodo: installmentForm.metodo,
        fecha: installmentForm.fecha,
        notas: installmentForm.notas.trim(),
      });
      toast.success("Abono registrado y saldo actualizado");
      resetInstallmentDialog();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo registrar el abono.");
    } finally {
      isSavingAccountRef.current = false;
      setIsSavingAccount(false);
    }
  };

  if (paymentsLoading || accountsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <PaymentSummaryCard
          title="Total pagado"
          value={formatCurrency(totalPaid)}
          description={`${activePayments.length} pago${activePayments.length === 1 ? "" : "s"} activo${activePayments.length === 1 ? "" : "s"}`}
          icon={WalletCards}
        />
        <PaymentSummaryCard
          title="Tratamientos"
          value={formatCurrency(treatmentPaid)}
          description="Ingresos clinicos vinculados"
          icon={ReceiptText}
        />
        <PaymentSummaryCard
          title="Saldo pendiente"
          value={formatCurrency(totalReceivableBalance)}
          description={`${pendingAccounts.length} cuenta${pendingAccounts.length === 1 ? "" : "s"} por cobrar`}
          icon={HandCoins}
          tone={totalReceivableBalance > 0 ? "warning" : "default"}
        />
        <PaymentSummaryCard
          title="Ultimo pago"
          value={lastPayment ? formatDate(lastPayment.fecha) : "Sin pagos"}
          description={lastPayment ? methodLabel[lastPayment.metodo] : "No hay cobros activos"}
          icon={CalendarClock}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HandCoins className="h-5 w-5 text-primary" />
              Cuentas por cobrar
            </CardTitle>
            {overdueAccounts.length > 0 && (
              <p className="mt-1 flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                {overdueAccounts.length} cuenta{overdueAccounts.length === 1 ? "" : "s"} sin abono reciente.
              </p>
            )}
          </div>
          <Button onClick={() => setIsAccountDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva cuenta
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {patientAccounts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Este paciente no tiene cuentas por cobrar.
            </div>
          ) : (
            <div className="divide-y">
              {patientAccounts.map((account) => (
                <div key={account.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{account.concepto}</p>
                      <Badge variant={account.estado === "vencida" ? "destructive" : account.estado === "pagada" ? "default" : "secondary"}>
                        {statusLabel[account.estado]}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <span>Total: <strong>{formatCurrency(account.total)}</strong></span>
                      <span>Abonado: <strong>{formatCurrency(account.totalAbonado)}</strong></span>
                      <span>Saldo: <strong>{formatCurrency(account.saldoPendiente)}</strong></span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Creada {formatDate(account.fechaCreacion)}</span>
                      <span>Ultimo abono {formatDate(account.fechaUltimoAbono)}</span>
                      {account.fechaVencimiento && <span>Vence {formatDate(account.fechaVencimiento)}</span>}
                      {account.diasSinAbono > 0 && <span>{account.diasSinAbono} dia(s) sin abono</span>}
                    </div>
                    {account.notas && (
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{account.notas}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex justify-start lg:justify-end">
                    {account.saldoPendiente > 0 && account.estado !== "cancelada" && (
                      <Button variant="outline" size="sm" onClick={() => setSelectedAccount(account)}>
                        <HandCoins className="mr-2 h-4 w-4" />
                        Agregar abono
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            Historial de pagos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {patientPayments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Este paciente aun no tiene pagos registrados.
            </div>
          ) : (
            <div className="divide-y">
              {patientPayments.map((payment) => (
                <div key={payment.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{payment.concepto || paymentSearchLabel(payment)}</p>
                      <Badge variant={payment.estado === "activo" ? "default" : "secondary"}>
                        {payment.estado === "activo" ? "Pagado" : "Cancelado"}
                      </Badge>
                      <Badge variant="outline">{paymentSearchLabel(payment)}</Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(payment.fecha)}</span>
                      <span>{methodLabel[payment.metodo]}</span>
                      {payment.citaId && <span>Cita vinculada</span>}
                      {payment.tratamientoId && <span>Tratamiento vinculado</span>}
                      {payment.cotizacionId && <span>Cotizacion vinculada</span>}
                      {!payment.pacienteId && <span>Coincidencia por nombre</span>}
                    </div>

                    {payment.notas && (
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{payment.notas}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <p className={cn("text-lg font-semibold", payment.estado === "cancelado" && "text-muted-foreground line-through")}>
                      {formatCurrency(payment.monto)}
                    </p>
                    <p className="text-xs text-muted-foreground">Folio {payment.id.slice(0, 8)}</p>
                    {payment.estado === "activo" && (
                      <Button variant="outline" size="sm" onClick={() => handleDownloadReceipt(payment)}>
                        <Download className="mr-2 h-4 w-4" />
                        Recibo
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canceledPayments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Los pagos cancelados se conservan para trazabilidad y no suman al total pagado.
        </p>
      )}

      <Dialog open={isAccountDialogOpen} onOpenChange={(open) => (open ? setIsAccountDialogOpen(true) : resetAccountDialog())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva cuenta por cobrar</DialogTitle>
            <DialogDescription>
              Registra el total del tratamiento y, si aplica, el primer abono. El abono requiere caja abierta.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="account-concept">Concepto</Label>
              <Input
                id="account-concept"
                value={accountForm.concepto}
                onChange={(event) => setAccountForm((current) => ({ ...current, concepto: event.target.value }))}
                placeholder="Tratamiento, paquete o procedimiento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-total">Total</Label>
              <Input
                id="account-total"
                type="number"
                min="0"
                step="0.01"
                value={accountForm.total}
                onChange={(event) => setAccountForm((current) => ({ ...current, total: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-initial">Abono inicial</Label>
              <Input
                id="account-initial"
                type="number"
                min="0"
                step="0.01"
                value={accountForm.abonoInicial}
                onChange={(event) => setAccountForm((current) => ({ ...current, abonoInicial: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Metodo</Label>
              <Select
                value={accountForm.metodo}
                onValueChange={(value: PaymentMethod) => setAccountForm((current) => ({ ...current, metodo: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-date">Fecha</Label>
              <Input
                id="account-date"
                type="date"
                value={accountForm.fecha}
                onChange={(event) => setAccountForm((current) => ({ ...current, fecha: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-due">Vencimiento</Label>
              <Input
                id="account-due"
                type="date"
                value={accountForm.fechaVencimiento}
                onChange={(event) => setAccountForm((current) => ({ ...current, fechaVencimiento: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-alert">Alertar despues de</Label>
              <Input
                id="account-alert"
                type="number"
                min="1"
                value={accountForm.alertaDiasSinAbono}
                onChange={(event) => setAccountForm((current) => ({ ...current, alertaDiasSinAbono: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="account-notes">Notas</Label>
              <Textarea
                id="account-notes"
                value={accountForm.notas}
                onChange={(event) => setAccountForm((current) => ({ ...current, notas: event.target.value }))}
                placeholder="Acuerdos de pago, referencias o indicaciones internas"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetAccountDialog} disabled={isSavingAccount}>
              Cancelar
            </Button>
            <Button onClick={handleCreateAccount} disabled={isSavingAccount}>
              {isSavingAccount ? "Guardando..." : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedAccount)} onOpenChange={(open) => !open && resetInstallmentDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
            <DialogDescription>
              {selectedAccount
                ? `${selectedAccount.concepto} - saldo ${formatCurrency(selectedAccount.saldoPendiente)}`
                : "Selecciona una cuenta para continuar."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="installment-amount">Monto</Label>
              <Input
                id="installment-amount"
                type="number"
                min="0"
                step="0.01"
                value={installmentForm.monto}
                onChange={(event) => setInstallmentForm((current) => ({ ...current, monto: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Metodo</Label>
                <Select
                  value={installmentForm.metodo}
                  onValueChange={(value: PaymentMethod) => setInstallmentForm((current) => ({ ...current, metodo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment-date">Fecha</Label>
                <Input
                  id="installment-date"
                  type="date"
                  value={installmentForm.fecha}
                  onChange={(event) => setInstallmentForm((current) => ({ ...current, fecha: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="installment-notes">Notas</Label>
              <Textarea
                id="installment-notes"
                value={installmentForm.notas}
                onChange={(event) => setInstallmentForm((current) => ({ ...current, notas: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetInstallmentDialog} disabled={isSavingAccount}>
              Cancelar
            </Button>
            <Button onClick={handleRegisterInstallment} disabled={isSavingAccount}>
              {isSavingAccount ? "Registrando..." : "Registrar abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientPayments;
