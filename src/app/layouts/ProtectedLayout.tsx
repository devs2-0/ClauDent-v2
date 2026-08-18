import React, { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";

import { Can, useAuth } from "@/auth";
import { usePatients } from "@/modules/patients";
import { AppSidebar } from "@/shared/components/layout/AppSidebar";
import { BottomNav } from "@/shared/components/layout/BottomNav";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/shared/components/ui/sidebar";
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

const HeaderOriginal = () => {
  const { currentUser, logout } = useAuth();
  const { patients } = usePatients();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement | null>(null);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);

  const filteredPatients = patients.filter((patient) => {
    if (!searchInput.trim()) return false;

    const term = searchInput.toLowerCase();
    const fullName = `${patient.nombres} ${patient.apellidos}`.toLowerCase();
    const curp = (patient.curp || "").toLowerCase();

    return fullName.includes(term) || curp.includes(term);
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setShowResults(false);
      }

      if (adminMenuRef.current && !adminMenuRef.current.contains(target)) {
        setAdminMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPatient = (patientId: string) => {
    navigate(`/pacientes/${patientId}`);
    setShowResults(false);
    setSearchInput("");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const go = (path: string) => {
    setAdminMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      <div className="hidden w-1 lg:block" />

      <div className="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="Logo"
          className="hidden w-16 rounded-md object-contain md:block"
        />

        <h1 className="text-lg font-bold text-foreground">ClauDent</h1>
      </div>

      <div className="mx-auto flex max-w-md flex-1 items-center gap-2">
        <div ref={searchRef} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            type="search"
            placeholder="Buscar..."
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            className="pl-10"
          />

          {showResults && searchInput.trim() !== "" && (
            <div className="absolute left-0 top-full z-50 mt-2 max-h-[300px] w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg">
              {filteredPatients.length > 0 ? (
                <ul className="py-1">
                  {filteredPatients.map((patient) => (
                    <li
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient.id)}
                      className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-4 py-3 transition-colors last:border-0 hover:bg-muted/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>

                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {patient.nombres} {patient.apellidos}
                        </span>

                        {patient.curp && (
                          <span className="text-xs text-muted-foreground">
                            {patient.curp}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No se encontraron pacientes.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative lg:hidden" ref={adminMenuRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-16 md:w-16"
            onClick={(event) => {
              event.stopPropagation();
              setAdminMenuOpen((current) => !current);
            }}
          >
            <Settings className="h-9 w-9 text-muted-foreground md:h-12 md:w-12" />
          </Button>

          {adminMenuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
              <Can permission="audit.view">
                <button
                  type="button"
                  onClick={() => go("/bitacora")}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-muted/50"
                >
                  <ClipboardList className="h-4 w-4" />
                  Bitácora
                </button>
              </Can>

              <Can permission="security.sessions.view">
                <button
                  type="button"
                  onClick={() => go("/seguridad")}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-muted/50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Seguridad
                </button>
              </Can>
            </div>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-3 lg:flex">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {currentUser?.email}
          </p>
          <p className="text-xs text-muted-foreground">Dentista</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu sesión se cerrará y deberás volver a iniciar sesión para
              continuar.
            </AlertDialogDescription>
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

const SidebarOverlayHandler = () => {
  const { state, isMobile } = useSidebar();

  if (state === "expanded" && !isMobile) {
    return <div className="fixed inset-0 z-20 bg-background/40 lg:hidden" />;
  }

  return null;
};

export const ProtectedLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <AppSidebar />

      <div className="hidden lg:block">
        <SidebarOverlayHandler />
      </div>

      <SidebarInset className="flex min-h-screen w-full flex-col overflow-x-hidden bg-background transition-all lg:pl-[3rem]">
        <HeaderOriginal />

        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          <Outlet />
        </main>

        <div className="block lg:hidden">
          <BottomNav />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default ProtectedLayout;