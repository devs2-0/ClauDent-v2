import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import {
  CheckCircle2,
  Clock,
  Globe2,
  Laptop,
  LogOut,
  Monitor,
  Search,
  ShieldCheck,
  Smartphone,
  Tablet,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth, usePermissions, type AppUser, type Role, type UserSession } from "@/auth";
import { db } from "@/lib/firebase";
import { addAuditLog } from "@/modules/audit/services/auditService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/utils/utils";

type SessionWithUser = UserSession & {
  userId: string;
  userEmail: string;
  userName: string;
  userStatus?: string;
  roleIds?: string[];
};

const getRoleLabels = (roleIds: string[] | undefined, rolesById: Map<string, Role>) => {
  if (!roleIds || roleIds.length === 0) return "sin rol";

  return roleIds
    .map((roleId) => rolesById.get(roleId)?.name || roleId)
    .join(", ");
};

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatLastActive = (value: any) => {
  const date = toDate(value);
  if (!date) return "Sin registro";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Activo ahora";
  if (diffMinutes === 1) return "Hace 1 minuto";
  if (diffMinutes < 60) return `Hace ${diffMinutes} minutos`;

  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const isRecentlyActive = (session: SessionWithUser) => {
  const date = toDate(session.lastActive);
  if (!date) return false;
  return Date.now() - date.getTime() < 2 * 60 * 1000;
};

const getDeviceIcon = (type: string) => {
  if (type === "Celular") return Smartphone;
  if (type === "Tablet") return Tablet;
  if (type?.includes("Portatil")) return Laptop;
  return Monitor;
};

const sessionSearchText = (session: SessionWithUser) => [
  session.userName,
  session.userEmail,
  session.deviceType,
  session.deviceLabel,
  session.browser,
  session.browserVersion,
  session.os,
  session.platform,
  session.language,
  session.timezone,
  session.roleIds?.join(" "),
].filter(Boolean).join(" ").toLowerCase();

const SecurityPage: React.FC = () => {
  const { currentUser, sessions, revokeSession, closeAllOtherSessions } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewAllSessions = hasPermission("security.sessions.view");
  const canRevokeAnySession = hasPermission("security.sessions.revoke");

  const [users, setUsers] = useState<Record<string, AppUser>>({});
  const [rolesById, setRolesById] = useState<Map<string, Role>>(new Map());
  const [globalSessionsByUser, setGlobalSessionsByUser] = useState<Record<string, SessionWithUser[]>>({});
  const [isLoadingGlobalSessions, setIsLoadingGlobalSessions] = useState(false);
  const [search, setSearch] = useState("");
  const [sessionToRevoke, setSessionToRevoke] = useState<SessionWithUser | null>(null);
  const [isBulkRevokeOpen, setIsBulkRevokeOpen] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const currentSessionId = sessions.find((session) => session.isCurrent)?.id ?? null;

  useEffect(() => {
    if (!canViewAllSessions) {
      setUsers({});
      setGlobalSessionsByUser({});
      setIsLoadingGlobalSessions(false);
      return;
    }

    setIsLoadingGlobalSessions(true);
    const sessionUnsubscribers: Array<() => void> = [];

    const unsubscribeRoles = onSnapshot(
      collection(db, "roles"),
      (snapshot) => {
        setRolesById(new Map(snapshot.docs.map((roleDoc) => [
          roleDoc.id,
          {
            id: roleDoc.id,
            ...roleDoc.data(),
          } as Role,
        ])));
      },
      () => {
        setRolesById(new Map());
      },
    );

    const unsubscribeUsers = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const nextUsers: Record<string, AppUser> = {};
      snapshot.docs.forEach((userDoc) => {
        nextUsers[userDoc.id] = {
          uid: userDoc.id,
          ...userDoc.data(),
        } as AppUser;
      });
      setUsers(nextUsers);

      sessionUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
      setGlobalSessionsByUser({});

      if (snapshot.empty) {
        setGlobalSessionsByUser({});
        setIsLoadingGlobalSessions(false);
        return;
      }

      snapshot.docs.forEach((userDoc) => {
        const user = {
          uid: userDoc.id,
          ...userDoc.data(),
        } as AppUser;

        const unsubscribeSessions = onSnapshot(
          collection(db, "usuarios", userDoc.id, "sesiones"),
          { includeMetadataChanges: true },
          (sessionSnapshot) => {
            if (sessionSnapshot.metadata.fromCache) return;

            const nextSessions = sessionSnapshot.docs
              .filter((sessionDoc) => {
                const data = sessionDoc.data();
                return data.status !== "revoked" && !data.revokedAt;
              })
              .map((sessionDoc) => {
                const data = sessionDoc.data();

                return {
                  id: sessionDoc.id,
                  userId: data.userId ?? userDoc.id,
                  userEmail: data.userEmail ?? user.email ?? "",
                  userName: data.userName ?? user.displayName ?? user.email ?? "Usuario",
                  deviceType: data.deviceType ?? "Computadora",
                  deviceLabel: data.deviceLabel ?? data.deviceType ?? "Dispositivo",
                  browser: data.browser ?? "Navegador",
                  browserVersion: data.browserVersion ?? "",
                  os: data.os ?? "",
                  platform: data.platform ?? "",
                  language: data.language ?? "",
                  timezone: data.timezone ?? "",
                  screen: data.screen ?? "",
                  viewport: data.viewport ?? "",
                  userAgent: data.userAgent ?? "",
                  online: data.online === true,
                  visibility: data.visibility ?? "",
                  startedAt: data.startedAt ?? null,
                  updatedAt: data.updatedAt ?? null,
                  lastActive: data.lastActive ?? null,
                  status: data.status ?? "active",
                  revokedAt: data.revokedAt ?? null,
                  isCurrent: userDoc.id === currentUser?.uid && sessionDoc.id === currentSessionId,
                } as SessionWithUser;
              });

            setGlobalSessionsByUser((current) => ({
              ...current,
              [userDoc.id]: nextSessions,
            }));
            setIsLoadingGlobalSessions(false);
          },
          (error) => {
            setIsLoadingGlobalSessions(false);
            toast.error(error.message || `No se pudieron cargar sesiones de ${user.email ?? userDoc.id}`);
          },
        );

        sessionUnsubscribers.push(unsubscribeSessions);
      });
    });

    return () => {
      unsubscribeUsers();
      unsubscribeRoles();
      sessionUnsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [canViewAllSessions, currentSessionId, currentUser?.uid]);

  const ownSessions = useMemo<SessionWithUser[]>(() => {
    return sessions.map((session) => ({
      ...session,
      userId: currentUser?.uid ?? "",
      userEmail: currentUser?.email ?? "",
      userName: currentUser?.displayName || currentUser?.email || "Tu cuenta",
    }));
  }, [currentUser, sessions]);

  const enrichedSessions = useMemo(() => {
    const source = canViewAllSessions
      ? Object.values(globalSessionsByUser).flat()
      : ownSessions;

    return source
      .map((session) => {
        const user = users[session.userId];
        return {
          ...session,
          userEmail: user?.email ?? session.userEmail,
          userName: user?.displayName || session.userName || user?.email || "Usuario",
          userStatus: user?.status,
          roleIds: user?.roleIds ?? session.roleIds ?? [],
          isCurrent: session.userId === currentUser?.uid && session.id === currentSessionId,
        };
      })
      .sort((a, b) => {
        const dateA = toDate(a.lastActive)?.getTime() ?? 0;
        const dateB = toDate(b.lastActive)?.getTime() ?? 0;
        return dateB - dateA;
      });
  }, [canViewAllSessions, currentSessionId, currentUser?.uid, globalSessionsByUser, ownSessions, users]);

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return enrichedSessions;
    return enrichedSessions.filter((session) => sessionSearchText(session).includes(term));
  }, [enrichedSessions, search]);

  const activeNowCount = enrichedSessions.filter(isRecentlyActive).length;
  const uniqueUserCount = new Set(enrichedSessions.map((session) => session.userId)).size;
  const remoteSessionCount = enrichedSessions.filter((session) => !session.isCurrent).length;

  const buildRevokedSessionPayload = (reason: string) => ({
    status: "revoked",
    online: false,
    revokedAt: serverTimestamp(),
    revokedByUid: currentUser?.uid ?? null,
    revokedByEmail: currentUser?.email ?? null,
    revokedByName: currentUser?.displayName || currentUser?.email || null,
    revokeReason: reason,
    updatedAt: serverTimestamp(),
  });

  const removeSessionsFromGlobalState = (sessionsToRemove: SessionWithUser[]) => {
    if (sessionsToRemove.length === 0) return;

    setGlobalSessionsByUser((current) => {
      const next = { ...current };

      sessionsToRemove.forEach((session) => {
        next[session.userId] = (next[session.userId] ?? []).filter((item) => item.id !== session.id);
      });

      return next;
    });
  };

  const revokeGlobalSession = async (session: SessionWithUser) => {
    if (session.isCurrent) return;

    if (!canRevokeAnySession && session.userId !== currentUser?.uid) {
      toast.error("Necesitas security.sessions.revoke para cerrar sesiones de otros usuarios");
      return;
    }

    setIsRevoking(true);
    if (session.userId === currentUser?.uid) {
      try {
        await revokeSession(session.id);
        await addAuditLog(
          "REVOKE_SESSION",
          "seguridad",
          `Sesion propia revocada: ${session.id} | ${session.browser} | ${session.os || session.platform || "Sin sistema"}`,
        );
      } finally {
        setIsRevoking(false);
        setSessionToRevoke(null);
      }
      return;
    }

    try {
      await updateDoc(
        doc(db, "usuarios", session.userId, "sesiones", session.id),
        buildRevokedSessionPayload("Sesion cerrada por administrador"),
      );
      removeSessionsFromGlobalState([session]);
      await addAuditLog(
        "REVOKE_SESSION",
        "seguridad",
        `Sesion de usuario revocada: ${session.userName} <${session.userEmail}> | UID: ${session.userId} | Sesion: ${session.id} | ${session.browser} | ${session.os || session.platform || "Sin sistema"}`,
      );
      toast.success("Sesion remota cerrada");
    } finally {
      setIsRevoking(false);
      setSessionToRevoke(null);
    }
  };

  const revokeAllRemoteSessions = async () => {
    const sessionsToClose = enrichedSessions.filter((session) => !session.isCurrent);
    if (sessionsToClose.length === 0) return;

    if (canViewAllSessions && !canRevokeAnySession) {
      toast.error("Necesitas security.sessions.revoke para cerrar sesiones de otros usuarios");
      return;
    }

    setIsRevoking(true);
    try {
      if (canViewAllSessions && canRevokeAnySession) {
        const batch = writeBatch(db);
        sessionsToClose.forEach((session) => {
          batch.update(
            doc(db, "usuarios", session.userId, "sesiones", session.id),
            buildRevokedSessionPayload("Cierre masivo de sesiones por administrador"),
          );
        });
        await batch.commit();
        removeSessionsFromGlobalState(sessionsToClose);
        await addAuditLog(
          "REVOKE_ALL_SESSIONS",
          "seguridad",
          `Cierre masivo de sesiones remotas: ${sessionsToClose.length} sesion(es) cerrada(s). Navegador actual conservado.`,
        );
        toast.success("Sesiones remotas cerradas");
      } else {
        await closeAllOtherSessions();
        await addAuditLog(
          "REVOKE_ALL_SESSIONS",
          "seguridad",
          `Cierre de sesiones propias remotas: ${sessionsToClose.length} sesion(es) cerrada(s).`,
        );
      }
    } finally {
      setIsRevoking(false);
      setIsBulkRevokeOpen(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Seguridad de acceso
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supervisa usuarios conectados, navegadores activos y actividad reciente.
          </p>
        </div>

        {remoteSessionCount > 0 && (
          <Button variant="destructive" onClick={() => setIsBulkRevokeOpen(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            {canViewAllSessions ? "Cerrar sesiones remotas" : "Cerrar mis otras sesiones"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sesiones activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrichedSessions.length}</div>
            <p className="text-xs text-muted-foreground">Documentos abiertos de sesion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Usuarios conectados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueUserCount}</div>
            <p className="text-xs text-muted-foreground">Cuentas con al menos una sesion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeNowCount}</div>
            <p className="text-xs text-muted-foreground">Actualizadas en los ultimos 2 minutos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Sesiones de usuarios</CardTitle>
              <CardDescription>
                {canViewAllSessions
                  ? "Vista administrativa de cuentas activas en la plataforma."
                  : "Vista de tus sesiones activas."}
              </CardDescription>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar usuario, correo, navegador..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-6">
          {isLoadingGlobalSessions && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Cargando sesiones activas...
            </div>
          )}

          {!isLoadingGlobalSessions && filteredSessions.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay sesiones para mostrar.
            </div>
          )}

          {filteredSessions.map((session) => {
            const DeviceIcon = getDeviceIcon(session.deviceType);
            const recent = isRecentlyActive(session);
            const canCloseSession = !session.isCurrent && (canRevokeAnySession || session.userId === currentUser?.uid);

            return (
              <div
                key={`${session.userId}-${session.id}`}
                className={cn(
                  "rounded-lg border p-4 transition-colors",
                  session.isCurrent ? "border-primary/40 bg-primary/5" : "bg-card hover:bg-muted/30",
                )}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <DeviceIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{session.userName}</p>
                          {session.isCurrent && <Badge>Este navegador</Badge>}
                          {recent ? (
                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Sin actividad reciente</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{session.userEmail}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Dispositivo</p>
                        <p className="font-medium">{session.deviceLabel || session.deviceType}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Navegador</p>
                        <p className="font-medium">
                          {session.browser}{session.browserVersion ? ` ${session.browserVersion}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Sistema</p>
                        <p className="font-medium">{session.os || session.platform || "No detectado"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Ultima actividad</p>
                        <p className="flex items-center gap-1 font-medium">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {formatLastActive(session.lastActive)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {session.timezone && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                          <Globe2 className="h-3.5 w-3.5" />
                          {session.timezone}
                        </span>
                      )}
                      {session.language && <span className="rounded-md bg-muted px-2 py-1">{session.language}</span>}
                      {session.screen && <span className="rounded-md bg-muted px-2 py-1">Pantalla {session.screen}</span>}
                      {session.viewport && <span className="rounded-md bg-muted px-2 py-1">Ventana {session.viewport}</span>}
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        {session.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        {session.online ? "Online al ultimo pulso" : "Offline al ultimo pulso"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 xl:min-w-48">
                    <div className="rounded-md border bg-muted/30 p-3 text-xs">
                      <p className="flex items-center gap-1 font-semibold">
                        <UserRound className="h-3.5 w-3.5" />
                        Usuario
                      </p>
                      <p className="mt-1 text-muted-foreground">Estado: {session.userStatus || "sin perfil"}</p>
                      <p className="text-muted-foreground">
                        Roles: {getRoleLabels(session.roleIds, rolesById)}
                      </p>
                    </div>

                    {!session.isCurrent && (
                      <Button
                        variant="outline"
                        onClick={() => setSessionToRevoke(session)}
                        disabled={!canCloseSession}
                        title={canCloseSession ? "Cerrar esta sesion" : "Necesitas security.sessions.revoke"}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar sesion
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          El navegador no expone IP publica confiable, direccion fisica ni ubicacion exacta. Para eso se necesita backend o Cloud Functions.
          Este panel usa informacion real disponible desde el cliente y la ultima actividad registrada en Firestore.
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(sessionToRevoke)} onOpenChange={(open) => !open && setSessionToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar sesion remota</AlertDialogTitle>
            <AlertDialogDescription>
              {sessionToRevoke
                ? `Se cerrara la sesion de ${sessionToRevoke.userName} (${sessionToRevoke.userEmail}) en ${sessionToRevoke.browser}. Esta accion quedara registrada en bitacora.`
                : "Esta accion cerrara una sesion remota."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRevoking || !sessionToRevoke}
              onClick={(event) => {
                event.preventDefault();
                if (sessionToRevoke) revokeGlobalSession(sessionToRevoke);
              }}
            >
              {isRevoking ? "Cerrando..." : "Si, cerrar sesion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkRevokeOpen} onOpenChange={setIsBulkRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar sesiones remotas</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerraran {remoteSessionCount} sesion(es) remota(s) y se conservara este navegador. La accion quedara registrada en bitacora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRevoking}
              onClick={(event) => {
                event.preventDefault();
                revokeAllRemoteSessions();
              }}
            >
              {isRevoking ? "Cerrando..." : "Si, cerrar sesiones"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SecurityPage;
