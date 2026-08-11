const ACTION_LABELS: Record<string, string> = {
  CREATE: "Creacion",
  UPDATE: "Actualizacion",
  DELETE: "Eliminacion",
  LOGIN: "Inicio de sesion",
  LOGOUT: "Cierre de sesion",
  REVOKE_SESSION: "Sesion cerrada",
  REVOKE_ALL_SESSIONS: "Cierre de sesiones",
};

const MODULE_LABELS: Record<string, string> = {
  SEGURIDAD: "Seguridad",
  SISTEMA: "Sistema",
};

const cleanSessionIds = (detail: string) => {
  return detail
    .replace(/\s*\|\s*Sesion:\s*sess_[a-z0-9]+/gi, "")
    .replace(/\s*ID:\s*sess_[a-z0-9]+/gi, "")
    .replace(/Sesion propia revocada:\s*sess_[a-z0-9]+\s*\|\s*/gi, "Sesion propia cerrada: ")
    .replace(/Sesion de usuario revocada:[^|]+UID:[^|]+\|\s*Sesion:\s*sess_[a-z0-9]+\s*\|\s*/gi, "Sesion de usuario cerrada: ")
    .replace(/sess_[a-z0-9]+/gi, "sesion");
};

export const getAuditActionLabel = (action?: string | null) => {
  if (!action) return "-";
  return ACTION_LABELS[action] || action.replace(/_/g, " ").toLowerCase();
};

export const getAuditModuleLabel = (module?: string | null) => {
  if (!module) return "-";
  const normalized = module.toUpperCase();
  return MODULE_LABELS[normalized] || module.charAt(0).toUpperCase() + module.slice(1).toLowerCase();
};

export const getAuditDetailLabel = (action?: string | null, detail?: string | null) => {
  const cleanDetail = cleanSessionIds(detail || "");

  if (action === "LOGIN") {
    return cleanDetail.toLowerCase().includes("nuevo dispositivo")
      ? "Inicio de sesion desde un dispositivo nuevo."
      : "Inicio de sesion registrado.";
  }

  if (action === "LOGOUT") return "Cierre de sesion registrado.";
  if (action === "REVOKE_SESSION") return cleanDetail || "Se cerro una sesion desde seguridad.";
  if (action === "REVOKE_ALL_SESSIONS") return cleanDetail || "Se cerraron sesiones remotas desde seguridad.";

  if (action === "UPDATE" && /sesion revocada/i.test(cleanDetail)) {
    return "Se cerro una sesion desde seguridad.";
  }

  return cleanDetail || "-";
};

export const getAuditSearchText = (log: any) => [
  log.detalle,
  getAuditDetailLabel(log.accion, log.detalle),
  log.usuarioNombre,
  log.usuarioEmail,
  log.modulo,
  getAuditModuleLabel(log.modulo),
  log.accion,
  getAuditActionLabel(log.accion),
].filter(Boolean).join(" ").toLowerCase();
