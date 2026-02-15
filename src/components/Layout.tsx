// RF-General: Layout Limpio + Responsive original + Tuerca móvil (afuera del buscador)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import {
  Search,
  LogOut,
  User,
  Settings,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react';

import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { useApp } from '@/state/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// HEADER
const HeaderOriginal = () => {
  const { currentUser, logout, patients } = useApp();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);

  const filteredPatients = patients.filter(patient => {
    if (!searchInput.trim()) return false;
    const term = searchInput.toLowerCase();
    const fullName = `${patient.nombres} ${patient.apellidos}`.toLowerCase();
    const curp = (patient.curp || '').toLowerCase();
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
    setSearchInput('');
  };

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const go = (path: string) => {
    setAdminMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="h-16 border-b border-border bg-card sticky top-0 z-40 flex items-center px-4 gap-4 w-full shadow-sm">

      {/* Espacio PC */}
      <div className="hidden lg:block w-1"></div>

      {/* Logo */}
      <div className="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="Logo"
          className="w-16 object-contain rounded-md hidden md:block"
        />
        <h1 className="text-lg font-bold text-foreground">ClauDent</h1>
      </div>

      {/* Contenedor buscador + tuerca */}
      <div className="flex items-center gap-2 flex-1 max-w-md mx-auto">

        {/* Buscador */}
        <div ref={searchRef} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            className="pl-10"
          />

          {showResults && searchInput.trim() !== '' && (
            <div className="absolute top-full left-0 w-full mt-2 bg-popover text-popover-foreground rounded-lg border shadow-lg z-50 max-h-[300px] overflow-y-auto">
              {filteredPatients.length > 0 ? (
                <ul className="py-1">
                  {filteredPatients.map((patient) => (
                    <li
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient.id)}
                      className="px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-0 border-border/50 flex items-center gap-3"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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

        {/* Tuerca solo móvil */}
        <div className="lg:hidden relative" ref={adminMenuRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-16 md:w-16"
            onClick={(e) => {
              e.stopPropagation();
              setAdminMenuOpen((v) => !v);
            }}
          >
            <Settings className="h-9 w-9 md:h-12 md:w-12 text-muted-foreground" />


          </Button>

          {adminMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-popover text-popover-foreground rounded-lg border shadow-lg z-50 overflow-hidden">
              <button
                onClick={() => go('/bitacora')}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted/50 text-left"
              >
                <ClipboardList className="h-4 w-4" />
                Bitácora
              </button>

              <button
                onClick={() => go('/seguridad')}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted/50 text-left"
              >
                <ShieldCheck className="h-4 w-4" />
                Seguridad
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Perfil PC */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{currentUser?.email}</p>
          <p className="text-xs text-muted-foreground">Dentista</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setLogoutDialogOpen(true)}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu sesión se cerrará y deberás volver a iniciar sesión para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
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
  const { state, toggleSidebar, isMobile } = useSidebar();

  if (state === 'expanded' && !isMobile) {
    return (
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={toggleSidebar}
        aria-hidden="true"
      />
    );
  }
  return null;
};

const Layout: React.FC = () => {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-50 h-full">
        <AppSidebar />
      </div>

      <div className="hidden lg:block">
        <SidebarOverlayHandler />
      </div>

      <SidebarInset className="bg-background flex flex-col min-h-screen w-full overflow-x-hidden lg:pl-[3rem] transition-all">
        <HeaderOriginal />

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 w-full max-w-full overflow-y-auto">
          <Outlet />
        </main>

        <div className="lg:hidden block">
          <BottomNav />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
