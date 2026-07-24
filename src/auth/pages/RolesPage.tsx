import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit,
  Plus,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Can, permissionCatalog, useAuth, useCan } from "@/auth";
import {
  DEFAULT_ROLE_COLOR,
  DEFAULT_ROLE_EMOJI,
  ROLE_COLORS,
  ROLE_EMOJIS,
} from "@/auth/constants/roleAppearance";
import { roleService } from "@/auth/services/roleService";
import type { PermissionDefinition, PermissionKey, Role } from "@/auth";
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
import { Textarea } from "@/shared/components/ui/textarea";

interface RoleFormState {
  id?: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  permissions: PermissionKey[];
}

const emptyForm: RoleFormState = {
  name: "",
  description: "",
  color: DEFAULT_ROLE_COLOR,
  icon: DEFAULT_ROLE_EMOJI,
  permissions: [],
};

const getRoleEmoji = (icon?: string | null) => {
  if (!icon) return DEFAULT_ROLE_EMOJI;

  return ROLE_EMOJIS.includes(icon as (typeof ROLE_EMOJIS)[number])
    ? icon
    : DEFAULT_ROLE_EMOJI;
};

const RolesPage = () => {
  const { currentUser } = useAuth();
  const { can } = useCan();

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);

  const permissionsByModule = useMemo(() => {
    return permissionCatalog.reduce(
      (acc, permission) => {
        if (!acc[permission.module]) {
          acc[permission.module] = [];
        }

        acc[permission.module].push(permission);
        return acc;
      },
      {} as Record<string, PermissionDefinition[]>,
    );
  }, []);

  const loadRoles = async () => {
    setLoading(true);

    try {
      const data = await roleService.listRoles();
      setRoles(data);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar los roles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const openCreateDialog = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    setForm({
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      color: role.color ?? DEFAULT_ROLE_COLOR,
      icon: getRoleEmoji(role.icon),
      permissions: role.permissions ?? [],
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;

    setDialogOpen(false);
    setEditingRole(null);
    setForm(emptyForm);
  };

  const togglePermission = (permission: PermissionKey) => {
    setForm((current) => {
      const exists = current.permissions.includes(permission);

      return {
        ...current,
        permissions: exists
          ? current.permissions.filter((item) => item !== permission)
          : [...current.permissions, permission],
      };
    });
  };

  const toggleModulePermissions = (
    modulePermissions: PermissionDefinition[],
    checked: boolean,
  ) => {
    const modulePermissionKeys = modulePermissions.map(
      (permission) => permission.key,
    );

    setForm((current) => {
      const currentPermissions = new Set(current.permissions);

      if (checked) {
        modulePermissionKeys.forEach((permission) =>
          currentPermissions.add(permission),
        );
      } else {
        modulePermissionKeys.forEach((permission) =>
          currentPermissions.delete(permission),
        );
      }

      return {
        ...current,
        permissions: Array.from(currentPermissions),
      };
    });
  };

  const handleSubmit = async () => {
    const name = form.name.trim();

    if (!name) {
      toast.error("El nombre del rol es obligatorio.");
      return;
    }

    if (!can(editingRole ? "roles.update" : "roles.create")) {
      toast.error("No tienes permiso para guardar roles.");
      return;
    }

    setSaving(true);

    try {
      if (editingRole) {
        await roleService.updateRole(
          editingRole.id,
          {
            name,
            description: form.description,
            color: form.color,
            icon: form.icon,
            permissions: form.permissions,
          },
          currentUser?.uid,
        );

        toast.success("Rol actualizado correctamente.");
      } else {
        await roleService.createRole(
          {
            name,
            description: form.description,
            color: form.color,
            icon: form.icon,
            permissions: form.permissions,
          },
          currentUser?.uid,
        );

        toast.success("Rol creado correctamente.");
      }

      closeDialog();
      await loadRoles();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el rol.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (role: Role) => {
    if (!can("roles.update")) {
      toast.error("No tienes permiso para cambiar el estado del rol.");
      return;
    }

    if (role.isSystem) {
      toast.error("No se recomienda desactivar roles del sistema.");
      return;
    }

    const nextStatus = role.status === "active" ? "archived" : "active";

    const confirmed = window.confirm(
      nextStatus === "archived"
        ? "¿Seguro que deseas desactivar este rol? Los usuarios que lo tengan perderán sus permisos efectivos de este rol."
        : "¿Deseas activar nuevamente este rol?",
    );

    if (!confirmed) return;

    try {
      await roleService.updateRole(
        role.id,
        { status: nextStatus },
        currentUser?.uid,
      );

      toast.success(
        nextStatus === "active"
          ? "Rol activado correctamente."
          : "Rol desactivado correctamente.",
      );

      await loadRoles();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cambiar el estado del rol.");
    }
  };

  const handleDelete = async (role: Role) => {
    if (!can("roles.delete")) {
      toast.error("No tienes permiso para eliminar roles.");
      return;
    }

    if (role.isSystem) {
      toast.error("No se puede eliminar un rol del sistema.");
      return;
    }

    const usageCount = await roleService.getRoleUsageCount(role.id);

    if (usageCount > 0) {
      toast.error(
        `No se puede eliminar este rol porque está asignado a ${usageCount} usuario(s).`,
      );
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) return;

    try {
      await roleService.deleteRole(role.id);
      toast.success("Rol eliminado correctamente.");
      await loadRoles();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el rol.",
      );
    }
  };

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Roles y permisos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra roles personalizados y define qué permisos tendrá cada
            perfil dentro de ClauDent.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadRoles} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>

          <Can permission="roles.create">
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo rol
            </Button>
          </Can>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Roles configurados</CardTitle>
          <CardDescription>
            Los roles del sistema sirven como base. Los roles personalizados se
            pueden crear, editar, activar, desactivar o eliminar si no están en
            uso.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Cargando roles...
            </div>
          ) : roles.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay roles registrados en Firestore.
            </div>
          ) : (
            <div className="grid gap-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="rounded-xl border bg-background p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-full text-xl shadow-sm"
                            style={{
                              backgroundColor:
                                role.color || DEFAULT_ROLE_COLOR,
                            }}
                          >
                            {getRoleEmoji(role.icon)}
                          </span>

                          <div>
                            <h2 className="font-semibold text-foreground">
                              {role.name}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              {role.id}
                            </p>
                          </div>
                        </div>

                        {role.isSystem && (
                          <Badge variant="secondary">Sistema</Badge>
                        )}

                        {role.isAdmin && (
                          <Badge>
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            Admin
                          </Badge>
                        )}

                        <Badge
                          variant={
                            role.status === "active" ? "outline" : "secondary"
                          }
                        >
                          {role.status === "active" ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>

                      <p className="max-w-2xl text-sm text-muted-foreground">
                        {role.description || "Sin descripción."}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {role.permissions.length} permiso(s) asignado(s)
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Can permission="roles.update">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(role)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                      </Can>

                      <Can permission="roles.update">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={role.isSystem}
                          onClick={() => handleToggleStatus(role)}
                        >
                          <Power className="mr-2 h-4 w-4" />
                          {role.status === "active"
                            ? "Desactivar"
                            : "Activar"}
                        </Button>
                      </Can>

                      <Can permission="roles.delete">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={role.isSystem}
                          onClick={() => handleDelete(role)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </Can>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Editar rol" : "Crear rol personalizado"}
            </DialogTitle>
            <DialogDescription>
              Selecciona la apariencia y los permisos que tendrá este rol. Los
              usuarios con este rol heredarán estos permisos en su navegación y
              acciones.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role-name">Nombre del rol *</Label>
                <Input
                  id="role-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ej. Recepción tarde"
                />
              </div>

              <div className="space-y-2">
                <Label>Permisos seleccionados</Label>
                <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">
                  {form.permissions.length} permiso(s)
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="role-description">Descripción</Label>
                <Textarea
                  id="role-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe para qué sirve este rol."
                />
              </div>

              <div className="space-y-5 md:col-span-2">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <Label>Vista previa</Label>

                  <div className="mt-3 flex items-center gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-sm"
                      style={{ backgroundColor: form.color }}
                    >
                      {form.icon}
                    </span>

                    <div>
                      <p className="font-semibold">
                        {form.name.trim() || "Nombre del rol"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {form.description.trim() ||
                          "Descripción del rol personalizado"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Emoji del rol</Label>

                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-11">
                    {ROLE_EMOJIS.map((emoji) => {
                      const selected = form.icon === emoji;

                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              icon: emoji,
                            }))
                          }
                          className={[
                            "flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition-all",
                            selected
                              ? "border-primary bg-primary/10 ring-2 ring-primary"
                              : "hover:bg-muted",
                          ].join(" ")}
                          aria-label={`Seleccionar emoji ${emoji}`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Color del rol</Label>

                  <div className="grid grid-cols-8 gap-2 sm:grid-cols-11 md:grid-cols-12">
                    {ROLE_COLORS.map((color) => {
                      const selected = form.color === color;

                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              color,
                            }))
                          }
                          className={[
                            "h-9 w-9 rounded-full border-2 transition-transform",
                            selected
                              ? "scale-110 border-foreground ring-2 ring-ring"
                              : "border-transparent hover:scale-105",
                          ].join(" ")}
                          style={{ backgroundColor: color }}
                          aria-label={`Seleccionar color ${color}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Permisos</h3>
                <p className="text-xs text-muted-foreground">
                  Los permisos están agrupados por módulo del sistema.
                </p>
              </div>

              <div className="grid gap-4">
                {Object.entries(permissionsByModule).map(
                  ([moduleName, modulePermissions]) => {
                    const allSelected = modulePermissions.every((permission) =>
                      form.permissions.includes(permission.key),
                    );

                    const someSelected = modulePermissions.some((permission) =>
                      form.permissions.includes(permission.key),
                    );

                    return (
                      <section
                        key={moduleName}
                        className="rounded-xl border p-4"
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h4 className="font-semibold capitalize">
                              {moduleName}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {modulePermissions.length} permiso(s)
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleModulePermissions(
                                modulePermissions,
                                !allSelected,
                              )
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {allSelected
                              ? "Quitar todos"
                              : someSelected
                                ? "Completar módulo"
                                : "Seleccionar módulo"}
                          </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          {modulePermissions.map((permission) => {
                            const checked = form.permissions.includes(
                              permission.key,
                            );

                            return (
                              <label
                                key={permission.key}
                                className="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() =>
                                    togglePermission(permission.key)
                                  }
                                />

                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">
                                      {permission.label}
                                    </span>

                                    {permission.isDangerous && (
                                      <Badge variant="destructive">
                                        Sensible
                                      </Badge>
                                    )}
                                  </div>

                                  <p className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </p>

                                  <code className="text-[11px] text-muted-foreground">
                                    {permission.key}
                                  </code>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>

            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : "Guardar rol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default RolesPage;