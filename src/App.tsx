import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./state/AppContext";
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
import LayoutV2 from "./components/LayoutV2";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  return currentUser ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

const EditorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const { currentUser, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Cargando aplicación...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/dashboard" /> : <Login />} />
      
      <Route path="/" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} />

      <Route path="/reset-password" element={<ResetPassword />} />
      
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/pacientes" element={<ProtectedRoute><Pacientes /></ProtectedRoute>} />
      <Route path="/pacientes/:id" element={<ProtectedRoute><FichaPaciente /></ProtectedRoute>} />
      <Route path="/servicios" element={<ProtectedRoute><Servicios /></ProtectedRoute>} />
      <Route path="/cotizaciones" element={<ProtectedRoute><Cotizaciones /></ProtectedRoute>} />
      
      <Route 
        path="/pacientes/:id/odontograma/:odontogramaId" 
        element={<EditorRoute><OdontogramEditorPage /></EditorRoute>} 
      />
      
      <Route path="*" element={<NotFound />} />

      <Route 
  path="/test-layout" 
  element={
    <ProtectedRoute>
      <LayoutV2>
        <Dashboard />
      </LayoutV2>
    </ProtectedRoute>
  } 
/>

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