import React, { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { LogOut, Search, User } from "lucide-react";

import { GlobalNotificationsButton } from "@/app/components/GlobalNotificationsButton";
import { useAuth, useCan } from "@/auth";
import { usePatients } from "@/modules/patients";
import { ThemeSwitch } from "@/shared/components/ThemeSwitch";
import { AppSidebar } from "@/shared/components/layout/AppSidebar";
import { BottomNav } from "@/shared/components/layout/BottomNav";
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
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";

const AppHeader = () => {
  const { currentUser, logout } = useAuth();
  const { can } = useCan();
  const canOpenPatient = can("patients.record.view");
  const { patients } = usePatients();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const filteredPatients = patients.filter((patient) => {
    if (!canOpenPatient || !searchInput.trim()) return false;
    const term = searchInput.toLowerCase();
    const fullName = `${patient.nombres} ${patient.apellidos}`.toLowerCase();
    return fullName.includes(term) || (patient.curp || "").toLowerCase().includes(term);
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPatient = (patientId: string) => {
    if (!canOpenPatient) return;
    navigate(`/pacientes/${patientId}`);
    setShowResults(false);
    setSearchInput("");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-5">
      <div className="flex shrink-0 items-center gap-1 border-r pr-3 sm:gap-2 sm:pr-4">
        <SidebarTrigger className="md:hidden" aria-label="Abrir menú" />
        <div className="hidden items-center gap-2 sm:flex">
          <img src="/logo.png" alt="ClauDent" className="h-9 w-9 rounded-md object-contain" />
          <h1 className="hidden text-base font-bold text-foreground md:block">ClauDent</h1>
        </div>
        <ThemeSwitch />
      </div>

      {canOpenPatient && <div ref={searchRef} className="relative mx-auto min-w-0 max-w-lg flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Buscar paciente"
          placeholder="Buscar paciente..."
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="h-9 pl-9"
        />

        {showResults && searchInput.trim() !== "" && (
          <div className="absolute left-0 top-full z-50 mt-2 max-h-[300px] w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg">
            {filteredPatients.length > 0 ? (
              <ul className="py-1">
                {filteredPatients.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectPatient(patient.id)}
                      className="flex w-full items-center gap-3 border-b border-border/50 px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted/50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{patient.nombres} {patient.apellidos}</span>
                        {patient.curp && <span className="block truncate text-xs text-muted-foreground">{patient.curp}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-3 text-center text-sm text-muted-foreground">No se encontraron pacientes.</div>
            )}
          </div>
        )}
      </div>}

      <div className="ml-auto flex shrink-0 items-center gap-1 border-l pl-3 sm:gap-2 sm:pl-4">
        <GlobalNotificationsButton />
        <p className="hidden max-w-44 truncate text-sm text-muted-foreground xl:block">
          {currentUser?.displayName || currentUser?.email}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>Tendrás que iniciar sesión nuevamente para continuar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleLogout()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
};

export const ProtectedLayout: React.FC = () => (
  <SidebarProvider defaultOpen={false}>
    <AppSidebar />
    <SidebarInset className="flex min-h-screen w-full flex-col overflow-x-hidden bg-background transition-all">
      <AppHeader />
      <main className="app-module-content flex-1 overflow-y-auto p-3 pb-20 sm:p-4 lg:p-5 lg:pb-5">
        <Outlet />
      </main>
      <div className="block lg:hidden">
        <BottomNav />
      </div>
    </SidebarInset>
  </SidebarProvider>
);

export default ProtectedLayout;
