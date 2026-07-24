import React from "react";

import { LoginPage, ResetPasswordPage, RolesPage, UsersPage } from "@/auth";
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
import { SecurityPage } from "@/modules/security";
import { ServicesPage } from "@/modules/services";
import { VentasPage } from "@/modules/ventas";
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
  path: "/usuarios",
  element: <UsersPage />,
  permission: "users.view",
  },
  {
    path: "/roles",
    element: <RolesPage />,
    permission: "roles.view",
  },
  {
    path: "/bitacora",
    element: <AuditPage />,
    permission: "audit.view",
  },
  {
    path: "/seguridad",
    element: <SecurityPage />,
    permission: "security.sessions.view",
  },
];

export const notFoundRoute: AppRouteConfig = {
  path: "*",
  element: <NotFoundPage />,
};