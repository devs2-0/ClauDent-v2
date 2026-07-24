import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  ShieldCheck,
  UserCog,
  UserX,
  UserCheck,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

import { Can, useAuth, useCan } from "@/auth";
import { roleService } from "@/auth/services/roleService";
import { userService } from "@/auth/services/userService";
import type { AppUser, AppUserStatus, Role } from "@/auth";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { X } from "lucide-react";
import {
  DEFAULT_ROLE_COLOR,
  DEFAULT_ROLE_EMOJI,
} from "@/auth/constants/roleAppearance";

const statusLabels: Record<AppUserStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  blocked: "Bloqueado",
};

const UsersPage = () => {
  const { currentUser } = useAuth();
  const { can } = useCan();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const rolesById = useMemo(() => {
    return new Map(roles.map((role) => [role.id, role]));
  }, [roles]);

  const activeRoles = useMemo(() => {
    return roles.filter((role) => role.status === "active");
  }, [roles]);

  const loadData = async () => {
    setLoading(true);

    try {
      const [usersData, rolesData] = await Promise.all([
        userService.listUsers(),
        roleService.listRoles(),
      ]);

      setUsers(usersData);
      setRoles(rolesData);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar usuarios o roles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openRoleDialog = (user: AppUser) => {
    setSelectedUser(user);
    setSelectedRoleIds(user.roleIds ?? []);
    setRoleDialogOpen(true);
  };

  const closeRoleDialog = () => {
    if (saving) return;

    setSelectedUser(null);
    setSelectedRoleIds([]);
    setRoleDialogOpen(false);
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((current) => {
      const exists = current.includes(roleId);

      return exists
        ? current.filter((item) => item !== roleId)
        : [...current, roleId];
    });
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    if (!can("roles.assign")) {
      toast.error("No tienes permiso para asignar roles.");
      return;
    }

    setSaving(true);

    try {
      await userService.assignRoles(
        selectedUser.uid,
        selectedRoleIds,
        currentUser?.uid,
      );

      toast.success("Roles asignados correctamente.");
      closeRoleDialog();
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron asignar los roles.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (user: AppUser, status: AppUserStatus) => {
    if (!can("users.update")) {
      toast.error("No tienes permiso para cambiar el estado del usuario.");
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que deseas cambiar el estado de ${user.email} a "${statusLabels[status]}"?`,
    );

    if (!confirmed) return;

    try {
      await userService.updateUserStatus(user.uid, status, currentUser?.uid);
      toast.success("Estado actualizado correctamente.");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado del usuario.",
      );
    }
  };

  const handleRecalculate = async (user: AppUser) => {
    if (!can("roles.assign")) {
      toast.error("No tienes permiso para recalcular permisos.");
      return;
    }

    try {
      await userService.recalculateUserPermissions(user.uid, currentUser?.uid);
      toast.success("Permisos recalculados correctamente.");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron recalcular los permisos.",
      );
    }
  };

  const removeSelectedRole = (roleId: string) => {
    setSelectedRoleIds((current) =>
      current.filter((item) => item !== roleId),
    );
  };

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Usuarios y roles
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Asigna uno o varios roles a usuarios reales del sistema y actualiza
            sus permisos efectivos.
          </p>
        </div>

        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios del sistema</CardTitle>
          <CardDescription>
            Los permisos visibles en menú y acciones se calculan a partir de los
            roles asignados a cada usuario.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Cargando usuarios...
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay usuarios registrados en Firestore.
            </div>
          ) : (
            <div className="grid gap-4">
              {users.map((user) => {
                const assignedRoles = user.roleIds
                  .map((roleId) => rolesById.get(roleId))
                  .filter(Boolean) as Role[];

                return (
                  <div
                    key={user.uid}
                    className="rounded-xl border bg-background p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold text-foreground">
                              {user.displayName || user.email}
                            </h2>

                            {user.isAdmin && (
                              <Badge>
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                Admin
                              </Badge>
                            )}

                            <Badge
                              variant={
                                user.status === "active"
                                  ? "outline"
                                  : user.status === "blocked"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {statusLabels[user.status]}
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            UID: {user.uid}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Roles asignados
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {assignedRoles.length > 0 ? (
                              assignedRoles.map((role) => (
                                <div className="flex flex-wrap gap-2">
                                  {assignedRoles.length > 0 ? (
                                    assignedRoles.map((role) => (
                                      <span
                                        key={role.id}
                                        className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs"
                                      >
                                        <span
                                          className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
                                          style={{ backgroundColor: role.color || DEFAULT_ROLE_COLOR }}
                                        >
                                          {role.icon || DEFAULT_ROLE_EMOJI}
                                        </span>

                                        {role.name}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Sin roles asignados
                                    </span>
                                  )}
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Sin roles asignados
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {user.permissions.length} permiso(s) efectivo(s)
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Can permission="roles.assign">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoleDialog(user)}
                          >
                            <UserCog className="mr-2 h-4 w-4" />
                            Asignar roles
                          </Button>
                        </Can>

                        <Can permission="roles.assign">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRecalculate(user)}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Recalcular
                          </Button>
                        </Can>

                        <Can permission="users.update">
                          {user.status !== "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleChangeStatus(user, "active")
                              }
                            >
                              <UserCheck className="mr-2 h-4 w-4" />
                              Activar
                            </Button>
                          )}

                          {user.status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleChangeStatus(user, "inactive")
                              }
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Desactivar
                            </Button>
                          )}

                          {user.status !== "blocked" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleChangeStatus(user, "blocked")
                              }
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Bloquear
                            </Button>
                          )}
                        </Can>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar roles</DialogTitle>
            <DialogDescription>
              Selecciona uno o varios roles para el usuario. Sus permisos
              efectivos se recalcularán al guardar.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-sm font-medium">
                  {selectedUser.displayName || selectedUser.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedUser.email}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Roles seleccionados</Label>

                {selectedRoleIds.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    Este usuario no tiene roles seleccionados.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedRoleIds.map((roleId) => {
                      const role = rolesById.get(roleId);

                      return (
                        <span
                          key={roleId}
                          className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-sm"
                        >
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-sm"
                            style={{
                              backgroundColor: role?.color || DEFAULT_ROLE_COLOR,
                            }}
                          >
                            {role?.icon || DEFAULT_ROLE_EMOJI}
                          </span>

                          <span>{role?.name ?? roleId}</span>

                          <button
                            type="button"
                            onClick={() => removeSelectedRole(roleId)}
                            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                            aria-label={`Quitar rol ${role?.name ?? roleId}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {activeRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay roles activos disponibles.
                  </p>
                ) : (
                  activeRoles.map((role) => {
                    const checked = selectedRoleIds.includes(role.id);

                    return (
                      <label
                        key={role.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleRole(role.id)}
                        />

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {role.name}
                            </span>

                            {role.isAdmin && (
                              <Badge>
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                Admin
                              </Badge>
                            )}

                            {role.isSystem && (
                              <Badge variant="secondary">Sistema</Badge>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {role.description || "Sin descripción."}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {role.permissions.length} permiso(s)
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRoleDialog}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default UsersPage;