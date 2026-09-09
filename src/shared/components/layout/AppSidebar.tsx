import React from "react";
import { Menu, PanelLeftClose, X } from "lucide-react";

import { navigationItems } from "@/app/navigation/navigationItems";
import { useCan } from "@/auth";
import { Button } from "@/shared/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/components/ui/sidebar";

import { NavLink } from "./NavLink";

export function AppSidebar() {
  const { can, loading } = useCan();
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const visibleItems = navigationItems.filter((item) => (item.anyPermission ? item.anyPermission.some((permission) => can(permission)) : can(item.permission)));
  const mainItems = visibleItems.filter((item) => item.url !== "/administracion");
  const administrationItems = visibleItems.filter((item) => item.url === "/administracion");

  const handleItemClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {state === "expanded" || isMobile ? (
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                CD
              </div>
              <div>
                <p className="text-sm font-semibold">ClauDent</p>
                <p className="text-[11px] text-muted-foreground">Consultorio dental</p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={isMobile ? "Cerrar menú" : "Contraer menú"}
              onClick={() => (isMobile ? setOpenMobile(false) : toggleSidebar())}
            >
              {isMobile ? <X className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Abrir menú"
              onClick={toggleSidebar}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {(state === "expanded" || isMobile) && (
            <SidebarGroupLabel>Menú principal</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {loading && (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-xs text-muted-foreground">Preparando menú...</div>
                </SidebarMenuItem>
              )}
              {!loading && mainItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        onClick={handleItemClick}
                        className="flex items-center gap-3"
                        activeClassName="bg-primary/10 text-primary"
                      >
                        <Icon className="h-5 w-5" />
                        {(state === "expanded" || isMobile) && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {!loading && mainItems.length === 0 && administrationItems.length === 0 && (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-xs text-muted-foreground">Sin módulos disponibles</div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!loading && administrationItems.length > 0 && (
          <SidebarGroup className="mt-auto border-t border-sidebar-border/70 pt-2">
            {(state === "expanded" || isMobile) && (
              <SidebarGroupLabel>Sistema</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {administrationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          onClick={handleItemClick}
                          className="flex items-center gap-3"
                          activeClassName="bg-primary/10 text-primary"
                        >
                          <Icon className="h-5 w-5" />
                          {(state === "expanded" || isMobile) && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
