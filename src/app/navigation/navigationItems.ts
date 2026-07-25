import {
  CalendarDays,
  FileText,
  Home,
  History,
  PackageSearch,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Tags,
  UserCog,
  Users,
  UsersRound
} from "lucide-react";

import type { PermissionKey } from "@/auth";

export interface NavigationItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: PermissionKey;
  mobile?: boolean;
}

export const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    permission: "dashboard.view",
    mobile: true,
  },
  {
    title: "Pacientes",
    url: "/pacientes",
    icon: Users,
    permission: "patients.view",
    mobile: true,
  },
  {
    title: "Servicios",
    url: "/servicios",
    icon: Stethoscope,
    permission: "services.view",
    mobile: true,
  },
  {
    title: "Cotizaciones",
    url: "/cotizaciones",
    icon: FileText,
    permission: "quotations.view",
    mobile: true,
  },
  {
    title: "Agenda",
    url: "/agenda",
    icon: CalendarDays,
    permission: "agenda.view",
    mobile: true,
  },
  {
    title: "Inventario",
    url: "/inventario",
    icon: PackageSearch,
    permission: "inventory.view",
  },
  {
    title: "Ventas",
    url: "/ventas",
    icon: ShoppingCart,
    permission: "sales.view",
  },
  {
    title: "Paquetes",
    url: "/paquetes",
    icon: Tags,
    permission: "packages.view",
  },
  {
  title: "Usuarios",
  url: "/usuarios",
  icon: UsersRound,
  permission: "users.view",
  },
  {
    title: "Roles",
    url: "/roles",
    icon: UserCog,
    permission: "roles.view",
  },
  {
    title: "Bitácora",
    url: "/bitacora",
    icon: History,
    permission: "audit.view",
  },
  {
    title: "Seguridad",
    url: "/seguridad",
    icon: ShieldCheck,
    permission: "security.sessions.view",
  },
];