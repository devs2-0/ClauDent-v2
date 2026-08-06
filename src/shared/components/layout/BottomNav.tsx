import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { navigationItems } from "@/app/navigation/navigationItems";
import { useAuth, useCan } from "@/auth";
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
import { cn } from "@/shared/utils/utils";

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { can } = useCan();

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const visibleItems = navigationItems
    .filter((item) => item.mobile)
    .filter((item) => can(item.permission))
    .slice(0, 4);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 border-t bg-background md:hidden">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.url;
          const Icon = item.icon;

          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setLogoutDialogOpen(true)}
          className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-destructive hover:text-destructive/80 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Salir</span>
        </button>
      </nav>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cierre de sesión</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará tu sesión actual. Asegúrate de haber guardado tu
              trabajo antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}