import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Users, Stethoscope, FileText } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const location = useLocation();

  const items = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Pacientes", url: "/pacientes", icon: Users },
    { title: "Servicios", url: "/servicios", icon: Stethoscope },
    { title: "Cotizaciones", url: "/cotizaciones", icon: FileText },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="mt-4">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    className="h-12" // Botones un poco más altos para elegancia
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span className="font-medium text-base">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}