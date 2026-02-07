import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppProvider, useApp } from "./state/AppContext";
import { Loader2 } from "lucide-react";

// Componentes y Páginas
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/Pacientes";
import FichaPaciente from "./pages/FichaPaciente";
import Servicios from "./pages/Servicios";
import Cotizaciones from "./pages/Cotizaciones";
import NotFound from "./pages/NotFound";
import OdontogramEditorPage from "./pages/OdontogramEditorPage";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

// 1. ProtectedRoute Moderno:
// Ya no envuelve hijos manualmente. Verifica auth y renderiza el Outlet (que será el Layout)
const ProtectedLayout = () => {
  const { currentUser, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si hay usuario, renderiza el Layout principal (que a su vez tiene un Outlet)
  return currentUser ? <Layout /> : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const { currentUser } = useApp();

  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/login" element={currentUser ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} />

      {/* RUTAS PROTEGIDAS CON LAYOUT 
         Aquí está la magia: Todos estos componentes se renderizan DENTRO del Layout
         gracias al <Outlet /> que pusimos en Layout.tsx
      */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pacientes" element={<Pacientes />} />
        <Route path="/pacientes/:id" element={<FichaPaciente />} />
        
        {/* CORRECCIÓN DE IDs AQUÍ: 
            Usamos :patientId y :odontogramId para coincidir con OdontogramEditorPage.tsx 
        */}
        <Route 
          path="/pacientes/:patientId/odontograma/:odontogramId" 
          element={<OdontogramEditorPage />} 
        />
        
        <Route path="/servicios" element={<Servicios />} />
        <Route path="/cotizaciones" element={<Cotizaciones />} />
      </Route>

      {/* Ruta 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;