import { useMemo, useState } from "react";
import { ShieldCheck, UserCog, UsersRound } from "lucide-react";

import { useCan } from "@/auth";
import RolesPage from "./RolesPage";
import UsersPage from "./UsersPage";
import { SecurityPage } from "@/modules/security";
import { SinPermisosPage } from "@/shared";
import { SectionHelp } from "@/shared/components/SectionHelp";
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
    <main className="space-y-4">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Panel de administración
          </h1>
          <SectionHelp title="Acerca del Panel de administración">
            <p>
              Reúne la gestión de usuarios, roles, permisos y seguridad del sistema.
            </p>
            <p>
              Solo verás las pestañas para las que tu cuenta tenga autorización.
            </p>
          </SectionHelp>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setSelectedTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 gap-2 sm:flex-none"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
};

export default AdminPanelPage;
