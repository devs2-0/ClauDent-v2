import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { AuthProvider } from "@/auth";
import { PackagesProvider } from "@/modules/packages";
import { PatientsProvider } from "@/modules/patients";
import { QuotationsProvider } from "@/modules/quotations";
import { DentalServicesProvider } from "@/modules/services";
import { InventoryProvider } from "@/modules/inventario";
import { CashProvider } from "@/modules/ventas";

const queryClient = new QueryClient();

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DentalServicesProvider>
          <PatientsProvider>
            <PackagesProvider>
              <QuotationsProvider>
                <InventoryProvider>
                  <CashProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      {children}
                    </TooltipProvider>
                  </CashProvider>
                </InventoryProvider>
              </QuotationsProvider>
            </PackagesProvider>
          </PatientsProvider>
        </DentalServicesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
