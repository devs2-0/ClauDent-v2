import React from "react";
import { LoginPage, ResetPasswordPage } from "@/auth";
import { AuditPage } from "@/modules/audit";
import { DashboardPage } from "@/modules/dashboard";
import { OdontogramEditorPage, PatientRecordPage, PatientsPage } from "@/modules/patients";
import { QuotationsPage } from "@/modules/quotations";
import { SecurityPage } from "@/modules/security";
import { ServicesPage } from "@/modules/services";
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
  { path: "/dashboard", element: <DashboardPage />, permission: "dashboard.view" },
  { path: "/pacientes", element: <PatientsPage />, permission: "patients.view" },
  { path: "/pacientes/:id", element: <PatientRecordPage />, permission: "patients.view" },
  { path: "/pacientes/:patientId/odontograma/:odontogramId", element: <OdontogramEditorPage />, permission: "patients.odontogram.view" },
  { path: "/servicios", element: <ServicesPage />, permission: "services.view" },
  { path: "/cotizaciones", element: <QuotationsPage />, permission: "quotations.view" },
  { path: "/bitacora", element: <AuditPage />, permission: "audit.view" },
  { path: "/seguridad", element: <SecurityPage />, permission: "security.sessions.view" },
];

export const notFoundRoute: AppRouteConfig = {
  path: "*",
  element: <NotFoundPage />,
};
