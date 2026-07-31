import { useMemo, useState } from "react";
import { ShieldCheck, UserCog, UsersRound } from "lucide-react";

import { useCan } from "@/auth";
import RolesPage from "./RolesPage";
import UsersPage from "./UsersPage";
import { SecurityPage } from "@/modules/security";
import { SinPermisosPage } from "@/shared";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";

const AdminPanelPage = () => {
  const { can, loading } = useCan();
  const [selectedTab, setSelectedTab] = useState("usuarios");

  const visibleTabs = useMemo(() => {
    return [
      {
        value: "usuarios",
        label: "Usuarios",
        icon: UsersRound,
        permission: "users.view" as const,
        content: <UsersPage />,
      },
      {
        value: "roles",
        label: "Roles",
        icon: UserCog,
        permission: "roles.view" as const,
        content: <RolesPage />,
      },
      {
        value: "seguridad",
        label: "Seguridad",
        icon: ShieldCheck,
        permission: "security.sessions.view" as const,
        content: <SecurityPage />,
      },
    ].filter((tab) => can(tab.permission));
  }, [can]);

  const activeTab = visibleTabs.some((tab) => tab.value === selectedTab)
    ? selectedTab
    : visibleTabs[0]?.value;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Cargando panel de administración...
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return <SinPermisosPage />;
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">
          Panel de administración
        </h1>

        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Administra usuarios, roles, permisos y seguridad desde un solo lugar.
          Las pestañas visibles dependen de los permisos asignados al usuario.
        </p>
      </section>

      <Tabs value={activeTab} onValueChange={setSelectedTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
};

export default AdminPanelPage;