export type PermissionModule =
  | "dashboard"
  | "patients"
  | "services"
  | "packages"
  | "quotations"
  | "agenda"
  | "inventory"
  | "sales"
  | "audit"
  | "security"
  | "users"
  | "roles"
  | "reports"
  | "settings";

export type PermissionLevel = "read" | "write" | "manage" | "admin";

export type PermissionKey =
  // Dashboard
  | "dashboard.view"

  // Pacientes
  | "patients.view"
  | "patients.create"
  | "patients.update"
  | "patients.delete"
  | "patients.clinicalHistory.view"
  | "patients.clinicalHistory.update"
  | "patients.odontogram.view"
  | "patients.odontogram.update"
  | "patients.attachments.view"
  | "patients.attachments.upload"
  | "patients.attachments.delete"

  // Servicios
  | "services.view"
  | "services.create"
  | "services.update"
  | "services.delete"

  // Paquetes / promociones
  | "packages.view"
  | "packages.create"
  | "packages.update"
  | "packages.delete"

  // Cotizaciones
  | "quotations.view"
  | "quotations.create"
  | "quotations.update"
  | "quotations.delete"
  | "quotations.pdf.generate"

  // Agenda
  | "agenda.view"
  | "agenda.doctors.viewAll"
  | "agenda.doctors.viewOwn"
  | "agenda.doctors.manage"
  | "agenda.assistants.manage"
  | "agenda.appointments.create"
  | "agenda.appointments.update"
  | "agenda.appointments.cancel"
  | "agenda.blocks.create"
  | "agenda.blocks.delete"
  | "agenda.changes.acknowledge"
  | "agenda.notifications.view"

  // Inventario
  | "inventory.view"
  | "inventory.create"
  | "inventory.update"
  | "inventory.delete"
  | "inventory.categories.manage"
  | "inventory.usage.create"
  | "inventory.stock.adjust"
  | "inventory.costs.view"
  | "inventory.purchaseList.manage"

  // Ventas / caja
  | "sales.view"
  | "sales.create"
  | "sales.cancel"
  | "sales.payments.manage"
  | "sales.cashShift.open"
  | "sales.cashShift.close"
  | "sales.cashCuts.history.view"
  | "sales.expenses.create"
  | "sales.reports.view"

  // Bitácora
  | "audit.view"

  // Seguridad / sesiones
  | "security.sessions.view"
  | "security.sessions.revoke"

  // Usuarios
  | "users.view"
  | "users.create"
  | "users.update"
  | "users.block"
  | "users.delete"

  // Roles
  | "roles.view"
  | "roles.create"
  | "roles.update"
  | "roles.delete"
  | "roles.assign"

  // Reportes generales
  | "reports.view"
  | "reports.export"

  // Configuración
  | "settings.view"
  | "settings.update";

export interface PermissionDefinition {
  key: PermissionKey;
  module: PermissionModule;
  group: string;
  label: string;
  description: string;
  level: PermissionLevel;
  isDangerous?: boolean;
}

export interface PermissionState {
  permissions: PermissionKey[];
  hasPermission: (permission?: PermissionKey | null) => boolean;
  hasEveryPermission: (permissions: PermissionKey[]) => boolean;
  hasSomePermission: (permissions: PermissionKey[]) => boolean;
}