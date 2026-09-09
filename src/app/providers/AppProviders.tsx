import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth, useCan } from "@/auth";
import { PackagesProvider } from "@/modules/packages";
import { PatientsProvider } from "@/modules/patients";
import { QuotationsProvider } from "@/modules/quotations";
import { DentalServicesProvider } from "@/modules/services";
import { InventoryProvider } from "@/modules/inventario";
import { CashProvider } from "@/modules/ventas";
import { AppearanceProvider } from "@/shared/appearance";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";

const queryClient = new QueryClient();

const AppChrome: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {children}
    </TooltipProvider>
  );
};

const BusinessProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { authLoading, currentUser, currentUserProfile, profileLoading } =
    useAuth();
  const { can } = useCan();

  const canMountBusinessData =
    Boolean(currentUser) &&
    !authLoading &&
    !profileLoading &&
    currentUserProfile?.status === "active";

  const canUseInventory =
    can("inventory.view") ||
    can("inventory.update") ||
    can("inventory.usage.create") ||
    can("inventory.stock.adjust") ||
    can("inventory.categories.manage") ||
    can("inventory.purchaseList.manage") ||
    can("sales.create") ||
    can("sales.view");

  const canUseCash =
    can("sales.view") ||
    can("sales.create") ||
    can("sales.payments.manage") ||
    can("sales.cancel") ||
    can("sales.expenses.create") ||
    can("sales.cashShift.open") ||
    can("sales.cashShift.close") ||
    can("sales.cashCuts.history.view") ||
    can("sales.reports.view") ||
    can("reports.view") ||
    can("reports.export");

  let content = <AppChrome>{children}</AppChrome>;

  if (!canMountBusinessData) {
    return content;
  }

  if (canUseCash) {
    content = <CashProvider>{content}</CashProvider>;
  }

  if (canUseInventory) {
    content = <InventoryProvider>{content}</InventoryProvider>;
  }

  return (
    <DentalServicesProvider>
      <PatientsProvider>
        <PackagesProvider>
          <QuotationsProvider>{content}</QuotationsProvider>
        </PackagesProvider>
      </PatientsProvider>
    </DentalServicesProvider>
  );
};

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppearanceProvider>
          <BusinessProviders>{children}</BusinessProviders>
        </AppearanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
