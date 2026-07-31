import React from "react";

import { AdminPanelPage, LoginPage, ResetPasswordPage, FirstAccessPage } from "@/auth";
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


import type { PermissionKey } from "@/auth";


export interface AppRouteConfig {
  path: string;
  element: React.ReactElement;
  permission?: PermissionKey;
}

export const publicRoutes: AppRouteConfig[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
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
    permission: "patients.view",
  },
  {
    path: "/pacientes/:patientId/odontograma/:odontogramId",
    element: <OdontogramEditorPage />,
    permission: "patients.odontogram.view",
  },
  {
    path: "/servicios",
    element: <ServicesPage />,
    permission: "services.view",
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
  },
];

export const notFoundRoute: AppRouteConfig = {
  path: "*",
  element: <NotFoundPage />,
};