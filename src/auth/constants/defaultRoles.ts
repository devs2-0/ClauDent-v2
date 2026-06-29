import { permissionKeys } from "./permissionCatalog";
import type { DefaultRoleDefinition } from "../types/role.types";

export const defaultRoles: DefaultRoleDefinition[] = [
  {
    id: "admin",
    name: "Administrador",
    description: "Acceso completo al sistema",
    permissions: permissionKeys,
    isSystem: true,
  },
  {
    id: "dentist",
    name: "Dentista",
    description: "Operacion clinica diaria",
    permissions: [
      "dashboard.view",
      "patients.view",
      "patients.create",
      "patients.update",
      "patients.clinicalHistory.view",
      "patients.clinicalHistory.update",
      "patients.odontogram.view",
      "patients.odontogram.update",
      "services.view",
      "quotations.view",
      "quotations.create",
      "quotations.pdf.generate",
    ],
    isSystem: true,
  },
  {
    id: "reception",
    name: "Recepcion",
    description: "Atencion y gestion operativa",
    permissions: [
      "dashboard.view",
      "patients.view",
      "patients.create",
      "patients.update",
      "services.view",
      "quotations.view",
      "quotations.create",
      "agenda.view",
      "agenda.appointments.create",
      "agenda.appointments.update",
      "agenda.appointments.cancel",
    ],
    isSystem: true,
  },
];
