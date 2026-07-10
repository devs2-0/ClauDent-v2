import React from "react";
import { LoginPage, ResetPasswordPage } from "@/auth";
import { AuditPage } from "@/modules/audit";
import { DashboardPage } from "@/modules/dashboard";
import { OdontogramEditorPage, PatientRecordPage, PatientsPage } from "@/modules/patients";
import { QuotationsPage } from "@/modules/quotations";
import { SecurityPage } from "@/modules/security";
import { ServicesPage } from "@/modules/services";
import { CajaPage } from "@/modules/ventas";
import { NotFoundPage } from "@/shared";

export interface AppRouteConfig {
  path: string;
  element: React.ReactElement;
}

export const publicRoutes: AppRouteConfig[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
];

export const protectedRoutes: AppRouteConfig[] = [
  { path: "/dashboard", element: <DashboardPage /> },
  { path: "/pacientes", element: <PatientsPage /> },
  { path: "/pacientes/:id", element: <PatientRecordPage /> },
  { path: "/pacientes/:patientId/odontograma/:odontogramId", element: <OdontogramEditorPage /> },
  { path: "/servicios", element: <ServicesPage /> },
  { path: "/cotizaciones", element: <QuotationsPage /> },
  { path: "/caja", element: <CajaPage /> },
  { path: "/bitacora", element: <AuditPage /> },
  { path: "/seguridad", element: <SecurityPage /> },
];

export const notFoundRoute: AppRouteConfig = {
  path: "*",
  element: <NotFoundPage />,
};
