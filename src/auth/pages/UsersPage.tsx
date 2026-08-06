import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  MailPlus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Can, useAuth, useCan } from "@/auth";
import {
  DEFAULT_ROLE_COLOR,
  DEFAULT_ROLE_EMOJI,
} from "@/auth/constants/roleAppearance";
import {
  userInvitationService,
  type UserInvitation,
} from "@/auth/services/userInvitationService";
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
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const statusLabels: Record<AppUserStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  blocked: "Bloqueado",
};

const emptyInviteForm = {
  displayName: "",
  email: "",
  phone: "",
  roleIds: [] as string[],
  status: "active" as AppUserStatus,
};

const UsersPage = () => {
  const { currentUser } = useAuth();
  const { can } = useCan();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);

  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const rolesById = useMemo(() => {
    return new Map(roles.map((role) => [role.id, role]));
  }, [roles]);

  const activeRoles = useMemo(() => {
    return roles.filter((role) => role.status === "active");
  }, [roles]);

  const visibleUsers = useMemo(() => {
    return users.filter((user) => (user as AppUser & { visible?: boolean }).visible !== false);
  }, [users]);

  const activeAdminCount = useMemo(() => {
    return users.filter((user) => user.isAdmin && user.status === "active")
      .length;
  }, [users]);

  const blurActiveElement = () => {
    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  };

  const handleDialogCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    blurActiveElement();

    window.requestAnimationFrame(() => {
      blurActiveElement();
    });
  };

  const resetInviteForm = () => {
    setInviteForm(emptyInviteForm);
  };

  const openInviteDialog = () => {
    resetInviteForm();
    setInviteDialogOpen(true);
  };

  const closeInviteDialog = () => {
    if (saving) return;

    blurActiveElement();
    setInviteDialogOpen(false);
  };

  const isCurrentSessionUser = (user: AppUser) => {
    return user.uid === currentUser?.uid;
  };

  const isOnlyActiveAdmin = (user: AppUser) => {
    return user.isAdmin && user.status === "active" && activeAdminCount <= 1;
  };

  const isProtectedUser = (user: AppUser) => {
    return isCurrentSessionUser(user) || isOnlyActiveAdmin(user);
  };

  const getProtectedUserMessage = (user: AppUser) => {
    if (isCurrentSessionUser(user)) {
      return "No puedes modificar tu propia cuenta desde aquí.";
    }

    if (isOnlyActiveAdmin(user)) {
      return "No puedes bloquear, desactivar o eliminar al único administrador activo.";
    }

    return null;
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const [usersData, rolesData, invitationsData] = await Promise.all([
        userService.listUsers(),
        roleService.listRoles(),
        can("users.view") || can("users.create")
          ? userInvitationService.listPendingInvitations()
          : Promise.resolve([]),
      ]);

      setUsers(usersData);
      setRoles(rolesData);
      setInvitations(invitationsData);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar usuarios, roles o invitaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRoleDialog = (user: AppUser) => {
    setSelectedUser(user);
    setSelectedRoleIds(user.roleIds ?? []);
    setRoleDialogOpen(true);
  };

  const closeRoleDialog = () => {
    if (saving) return;

    blurActiveElement();
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

  const removeSelectedRole = (roleId: string) => {
    setSelectedRoleIds((current) =>
      current.filter((item) => item !== roleId),
    );
  };

  const toggleInviteRole = (roleId: string) => {
    setInviteForm((current) => {
      const exists = current.roleIds.includes(roleId);

      return {
        ...current,
        roleIds: exists
          ? current.roleIds.filter((item) => item !== roleId)
          : [...current.roleIds, roleId],
      };
    });
  };

  const handleCreateInvitation = async () => {
    if (!can("users.create")) {
      toast.error("No tienes permiso para invitar usuarios.");
      return;
    }

    const displayName = inviteForm.displayName.trim();
    const email = inviteForm.email.trim().toLowerCase();

    if (!displayName) {
      toast.error("El nombre es obligatorio.");
      return;
    }

    if (!email) {
      toast.error("El correo es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      await userInvitationService.createInvitation(
        {
          displayName,
          email,
          phone: inviteForm.phone.trim(),
          roleIds: inviteForm.roleIds,
          status: inviteForm.status,
        },
        roles,
        currentUser?.uid,
      );

      toast.success("Invitación creada correctamente.");
      closeInviteDialog();
      resetInviteForm();
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo crear la invitación.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelInvitation = async (invitation: UserInvitation) => {
    if (!can("users.update") && !can("users.create")) {
      toast.error("No tienes permiso para cancelar invitaciones.");
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que deseas cancelar la invitación para ${invitation.email}?`,
    );

    if (!confirmed) return;

    try {
      await userInvitationService.cancelInvitation(
        invitation.email,
        currentUser?.uid,
      );

      toast.success("Invitación cancelada correctamente.");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cancelar la invitación.");
    }
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

  const handleDeleteUser = async (user: AppUser) => {
    if (!can("users.delete")) {
      toast.error("No tienes permiso para eliminar usuarios.");
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que deseas ocultar y bloquear a ${user.email}? La cuenta seguirá existiendo en Firebase Auth, pero no podrá usar ClauDent.`,
    );

    if (!confirmed) return;

    try {
      await userInvitationService.softDeleteUserAccess(user.uid, currentUser?.uid);
      toast.success("Usuario bloqueado y ocultado correctamente.");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar visualmente al usuario.",
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

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Usuarios e invitaciones
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Invita empleados, asigna roles y administra el acceso al sistema sin
            usar Cloud Functions ni plan Blaze.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>

          <Can permission="users.create">
            <Button onClick={openInviteDialog}>
              <MailPlus className="mr-2 h-4 w-4" />
              Nueva invitación
            </Button>
          </Can>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Invitaciones pendientes</CardTitle>
          <CardDescription>
            Estos correos ya pueden entrar por la pantalla de Primer acceso para
            crear su contraseña.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Cargando invitaciones...
            </div>
          ) : invitations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No hay invitaciones pendientes.
            </div>
          ) : (
            <div className="grid gap-3">
              {invitations.map((invitation) => {
                const invitationRoles = invitation.roleIds
                  .map((roleId) => rolesById.get(roleId))
                  .filter(Boolean) as Role[];

                return (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-3 rounded-xl border bg-background p-4 md:flex-row md:items-start md:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">
                          {invitation.displayName}
                        </h2>

                        {invitation.isAdmin && (
                          <Badge>
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            Admin
                          </Badge>
                        )}

                        <Badge variant="secondary">Pendiente</Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {invitation.email}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {invitationRoles.length > 0 ? (
                          invitationRoles.map((role) => (
                            <span
                              key={role.id}
                              className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs"
                            >
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
                                style={{
                                  backgroundColor:
                                    role.color || DEFAULT_ROLE_COLOR,
                                }}
                              >
                                {role.icon || DEFAULT_ROLE_EMOJI}
                              </span>
                              {role.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin roles iniciales
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation)}
                    >
                      Cancelar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
          ) : visibleUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay usuarios registrados en Firestore.
            </div>
          ) : (
            <div className="grid gap-4">
              {visibleUsers.map((user) => {
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
                            {user.isAdmin ? (
                              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                <ShieldCheck className="h-4 w-4" />
                                Administrador del sistema
                              </span>
                            ) : assignedRoles.length > 0 ? (
                              assignedRoles.map((role) => (
                                <span
                                  key={role.id}
                                  className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs"
                                >
                                  <span
                                    className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
                                    style={{
                                      backgroundColor:
                                        role.color || DEFAULT_ROLE_COLOR,
                                    }}
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
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {user.isAdmin
                            ? "Acceso total de administrador"
                            : `${user.permissions.length} permiso(s) efectivo(s)`}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Can permission="roles.assign">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              isOnlyActiveAdmin(user) ||
                              isCurrentSessionUser(user)
                            }
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

                        {isProtectedUser(user) ? (
                          <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            {getProtectedUserMessage(user)}
                          </div>
                        ) : (
                          <>
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

                            <Can permission="users.delete">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </Button>
                            </Can>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={inviteDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setInviteDialogOpen(true);
            return;
          }

          closeInviteDialog();
        }}
      >
        <DialogContent
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
          onCloseAutoFocus={handleDialogCloseAutoFocus}
          onEscapeKeyDown={blurActiveElement}
          onPointerDownOutside={blurActiveElement}
        >
          <DialogHeader>
            <DialogTitle>Crear invitación de acceso</DialogTitle>
            <DialogDescription>
              Registra el correo del empleado y sus roles iniciales. El empleado
              creará su propia contraseña desde Primer acceso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nombre *</Label>
                <Input
                  id="invite-name"
                  value={inviteForm.displayName}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  placeholder="Ej. Ana Pérez"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email">Correo *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="empleado@claudent.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-phone">Teléfono</Label>
                <Input
                  id="invite-phone"
                  value={inviteForm.phone}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Roles iniciales</Label>

              {activeRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay roles activos disponibles.
                </p>
              ) : (
                activeRoles.map((role) => {
                  const checked = inviteForm.roleIds.includes(role.id);

                  return (
                    <label
                      key={role.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleInviteRole(role.id)}
                      />

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-sm"
                            style={{
                              backgroundColor:
                                role.color || DEFAULT_ROLE_COLOR,
                            }}
                          >
                            {role.icon || DEFAULT_ROLE_EMOJI}
                          </span>

                          <span className="text-sm font-medium">
                            {role.name}
                          </span>

                          {role.isAdmin && (
                            <Badge>
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {role.description || "Sin descripción."}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeInviteDialog}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button onClick={handleCreateInvitation} disabled={saving}>
              {saving ? "Creando..." : "Crear invitación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={roleDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setRoleDialogOpen(true);
            return;
          }

          closeRoleDialog();
        }}
      >
        <DialogContent
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
          onCloseAutoFocus={handleDialogCloseAutoFocus}
          onEscapeKeyDown={blurActiveElement}
          onPointerDownOutside={blurActiveElement}
        >
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
                              backgroundColor:
                                role?.color || DEFAULT_ROLE_COLOR,
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
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full text-sm"
                              style={{
                                backgroundColor:
                                  role.color || DEFAULT_ROLE_COLOR,
                              }}
                            >
                              {role.icon || DEFAULT_ROLE_EMOJI}
                            </span>

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
