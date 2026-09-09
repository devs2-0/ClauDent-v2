import React from "react";

import {
  AdminPanelPage,
  FirstAccessPage,
  LoginPage,
  ResetPasswordPage,
} from "@/auth";
import type { PermissionKey } from "@/auth";
import { AuditPage } from "@/modules/audit";
import { AgendaPage } from "@/modules/agenda";
import { DashboardPage } from "@/modules/dashboard";
import { InventarioPage } from "@/modules/inventario";
import {
  OdontogramEditorPage,
  PatientRecordPage,
  PatientsPage,
} from "@/modules/patients";
import { QuotationsPage } from "@/modules/quotations";
import { ServicesPage } from "@/modules/services";
import { CajaPage, VentasPage } from "@/modules/ventas";
import { NotFoundPage } from "@/shared";

export interface AppRouteConfig {
  path: string;
  element: React.ReactElement;
  permission?: PermissionKey;
  anyPermission?: PermissionKey[];
  redirectAuthenticated?: boolean;
}

export const publicRoutes: AppRouteConfig[] = [
  {
    path: "/login",
    element: <LoginPage />,
    redirectAuthenticated: true,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
    redirectAuthenticated: true,
  },
  {
    path: "/primer-acceso",
    element: <FirstAccessPage />,
  },
];

export const protectedRoutes: AppRouteConfig[] = [
  {
    path: "/dashboard",
    element: <DashboardPage />,
    permission: "dashboard.view",
  },
  {
    path: "/pacientes",
    element: <PatientsPage />,
    permission: "patients.view",
  },
  {
    path: "/pacientes/:id",
    element: <PatientRecordPage />,
    permission: "patients.record.view",
  },
  {
    path: "/pacientes/:patientId/odontograma/:odontogramId",
    element: <OdontogramEditorPage />,
    permission: "patients.odontogram.view",
  },
  {
    path: "/servicios",
    element: <ServicesPage />,
    anyPermission: ["services.view", "packages.view"],
  },
  {
    path: "/cotizaciones",
    element: <QuotationsPage />,
    permission: "quotations.view",
  },
  {
    path: "/agenda",
    element: <AgendaPage />,
    permission: "agenda.view",
  },
  {
    path: "/inventario",
    element: <InventarioPage />,
    permission: "inventory.view",
  },
  {
    path: "/ventas",
    element: <VentasPage />,
    permission: "sales.view",
  },
  {
    path: "/caja",
    element: <CajaPage />,
    permission: "sales.cashShift.open",
  },
  {
    path: "/bitacora",
    element: <AuditPage />,
    permission: "audit.view",
  },
  {
    path: "/administracion",
    element: <AdminPanelPage />,
    anyPermission: [
      "users.view",
      "roles.view",
      "security.sessions.view",
      "settings.view",
    ],
  },
];

export const notFoundRoute: AppRouteConfig = {
  path: "*",
  element: <NotFoundPage />,
};