import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Stethoscope, FileText, LogOut } from "lucide-react";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BottomNav() {
  const location = useLocation();
  const { logout } = useApp();
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = [
    { title: "Inicio", url: "/dashboard", icon: Home },
    { title: "Pacientes", url: "/pacientes", icon: Users },
    { title: "Servicios", url: "/servicios", icon: Stethoscope },
    { title: "Cotizaciones", url: "/cotizaciones", icon: FileText },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border h-16 flex items-center justify-around px-2 pb-safe shadow-lg">
      {items.map((item) => {
        const isActive = location.pathname === item.url;
        const Icon = item.icon;
        
        return (
          <Link
            key={item.title}
            to={item.url}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full text-[10px] font-medium transition-colors",
              isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "fill-current/20")} />
            <span>{item.title}</span>
          </Link>
        );
      })}

      {/* Botón de Cerrar Sesión (Solo Móvil) */}
      <button
        onClick={() => setLogoutDialogOpen(true)}
        className="flex flex-col items-center justify-center gap-1 w-full h-full text-[10px] font-medium text-destructive hover:text-destructive/80 transition-colors"
      >
        <LogOut className="h-5 w-5" />
        <span>Salir</span>
      </button>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cierre de sesión</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará tu sesión actual. Asegúrate de haber guardado tu trabajo antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}