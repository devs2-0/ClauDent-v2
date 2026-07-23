import React from "react";
import { LogOut, Menu, PanelLeftClose, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { navigationItems } from "@/app/navigation/navigationItems";
import { useAuth, useCan } from "@/auth";
import { Button } from "@/shared/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  const { logout } = useAuth();
  const { can, loading } = useCan();
  const navigate = useNavigate();

  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();

  const visibleItems = navigationItems.filter((item) => can(item.permission));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleItemClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {state === "expanded" || isMobile ? (
          <div className="flex items-center justify-between px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                CD
              </div>

              <div>
                <p className="text-sm font-semibold">ClauDent</p>
                <p className="text-xs text-muted-foreground">
                  Consultorio dental
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => (isMobile ? setOpenMobile(false) : toggleSidebar())}
            >
              {isMobile ? (
                <X className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
          </div>
        ) : (
          <div className="flex justify-center py-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {(state === "expanded" || isMobile) && (
            <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
          )}

          <SidebarGroupContent>
            <SidebarMenu>
              {loading && (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Cargando permisos...
                  </div>
                </SidebarMenuItem>
              )}

              {!loading &&
                visibleItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          onClick={handleItemClick}
                          className="flex items-center gap-3"
                          activeClassName="bg-primary/10 text-primary"
                        >
                          <Icon className="h-5 w-5" />

                          {(state === "expanded" || isMobile) && (
                            <span>{item.title}</span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}

              {!loading && visibleItems.length === 0 && (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Sin módulos disponibles
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {state === "expanded" || isMobile ? (
          <Button
            type="button"
            variant="ghost"
            className="justify-start gap-3 text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}