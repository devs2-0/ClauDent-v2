// RF-General: Layout Limpio (Botón de menú movido al Sidebar)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import {
  Search,
  LogOut,
  User
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

// Componente Header Interno
const HeaderOriginal = () => {
  // Ya no necesitamos 'toggleSidebar' aquí
  const { currentUser, logout, patients } = useApp();
  const navigate = useNavigate();
  
  const [searchInput, setSearchInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredPatients = patients.filter(patient => {
    if (!searchInput.trim()) return false;
    const term = searchInput.toLowerCase();
    const fullName = `${patient.nombres} ${patient.apellidos}`.toLowerCase();
    const curp = (patient.curp || '').toLowerCase();
    return fullName.includes(term) || curp.includes(term);
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
    navigate(`/pacientes/${patientId}`);
    setShowResults(false);
    setSearchInput('');
  };

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-border bg-card sticky top-0 z-40 flex items-center px-4 gap-4 w-full shadow-sm">
      {/* ESPACIO VACÍO A LA IZQUIERDA (Donde antes estaba el menú) */}
      <div className="hidden lg:block w-1"></div>

      <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-16 object-contain rounded-md hidden md:block" />
          <h1 className="text-lg font-bold text-foreground ">ClauDent</h1>  
      </div>

      <div ref={searchRef} className="flex-1 max-w-md mx-auto relative">
        <div className="relative">
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
        </div>

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
                      <span className="text-sm font-medium">{patient.nombres} {patient.apellidos}</span>
                      {patient.curp && (
                        <span className="text-xs text-muted-foreground">{patient.curp}</span>
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
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
};

// Componente auxiliar para manejar el "Click Outside"
const SidebarOverlayHandler = () => {
  const { state, toggleSidebar, isMobile } = useSidebar();
  
  if (state === 'expanded' && !isMobile) {
    return (
      <div 
        className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-200" 
        onClick={toggleSidebar} 
        aria-hidden="true"
      />
    );
  }
  return null;
};

// --- LAYOUT ---
const Layout: React.FC = () => {
  return (
    <SidebarProvider defaultOpen={false}>
      
      {/* 1. SIDEBAR FLOTANTE */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-50 h-full">
        <AppSidebar />
      </div>

      {/* 2. OVERLAY PARA CERRAR (Clic fuera) */}
      <div className="hidden lg:block">
        <SidebarOverlayHandler />
      </div>

      {/* 3. CONTENIDO PRINCIPAL */}
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