import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Stethoscope,
  LogOut,
  User
} from 'lucide-react';
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { useApp } from '@/state/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';

// Componente Header Interno con Buscador Autocompletado
const HeaderOriginal = () => {
  const { toggleSidebar } = useSidebar(); 
  const { currentUser, logout, patients } = useApp(); // Traemos 'patients' del contexto
  const navigate = useNavigate();
  
  // Estados para el buscador
  const [searchInput, setSearchInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null); // Referencia para detectar clics fuera

  // Lógica de filtrado
  const filteredPatients = patients.filter(patient => {
    if (!searchInput.trim()) return false;
    const term = searchInput.toLowerCase();
    const fullName = `${patient.nombres} ${patient.apellidos}`.toLowerCase();
    const curp = (patient.curp || '').toLowerCase();
    return fullName.includes(term) || curp.includes(term);
  });

  // Cerrar el dropdown si haces clic fuera
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
    setSearchInput(''); // Limpiar buscador al ir
  };

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-border bg-card sticky top-0 z-40 flex items-center px-4 gap-4 w-full">
      {/* Botón Menú (PC) */}
      <div className="hidden lg:block">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-3">
          <img src="/logo.png" alt="ClauDent Logo" className="w-16 object-contain rounded-md" />  
        <h1 className="text-lg font-semibold text-foreground hidden sm:block">ClauDent</h1>
      </div>

      {/* --- ZONA DE BÚSQUEDA INTELIGENTE --- */}
      <div ref={searchRef} className="flex-1 max-w-md mx-auto relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar pacientes..." 
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            className="pl-10"
            aria-label="Buscar pacientes"
          />
        </div>

        {/* Dropdown de Resultados (Flotante) */}
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

      {/* Usuario y Logout (PC) */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{currentUser?.email}</p>
          <p className="text-xs text-muted-foreground">Dentista</p> 
        </div>
        <Button variant="ghost" size="icon" onClick={() => setLogoutDialogOpen(true)} aria-label="Cerrar sesión">
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

// Layout Principal (Sin cambios en estructura, solo consume el nuevo Header)
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      <SidebarInset className="bg-background flex flex-col min-h-screen w-full overflow-x-hidden">
        <HeaderOriginal />
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 w-full max-w-full overflow-y-auto">
            {children}
        </main>
        <div className="lg:hidden block">
          <BottomNav />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;