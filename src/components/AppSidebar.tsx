import React from 'react';
import {
  Home,
  Users,
  FileText,
  LogOut,
  Stethoscope,
  PanelLeftClose, // Icono para cerrar
  Menu // Icono de hamburguesa (3 rayas)
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar, 
} from "@/components/ui/sidebar";
import { NavLink } from './NavLink'; 
import { useApp } from '@/state/AppContext';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const items = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Cotizaciones", url: "/cotizaciones", icon: FileText },
  { title: "Servicios", url: "/servicios", icon: Stethoscope },
];

export function AppSidebar() {
  const { logout } = useApp();
  const navigate = useNavigate();
  const { state, toggleSidebar } = useSidebar(); 

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card shadow-2xl z-50 transition-all duration-300">
      <SidebarHeader className="p-0 border-b border-border h-16 flex items-center justify-center">
        {/* LÓGICA DEL BOTÓN DE APERTURA */}
        {state === 'expanded' ? (
           /* MODO EXPANDIDO: Logo completo + Botón cerrar a la derecha */
           <div className="w-full h-full flex items-center justify-between px-4">
             <div className="flex items-center gap-2 overflow-hidden">
                <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm">
                  CD
                </div>
                <span className="font-bold text-lg text-primary truncate">ClauDent</span>
             </div>
             <Button variant="ghost" size="icon" onClick={toggleSidebar} title="Colapsar menú">
               <PanelLeftClose className="h-5 w-5 text-muted-foreground" />
             </Button>
           </div>
        ) : (
           /* MODO COLAPSADO: Botón de Menú (Hamburguesa) centrado */
           <div className="w-full h-full flex items-center justify-center">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSidebar} 
                className="h-10 w-10 text-primary hover:bg-primary/10"
                title="Expandir menú"
              >
                  <Menu className="h-6 w-6" />
              </Button>
           </div>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>


      <SidebarFooter className="p-4 border-t border-border">
          {/* 
          
          {state === 'expanded' ? (
             <Button 
                variant="outline" 
                className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={handleLogout}
             >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
             </Button>
         ) : (
             <Button 
                variant="ghost" 
                size="icon"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full"
                onClick={handleLogout}
                title="Cerrar Sesión"
             >
                <LogOut className="h-4 w-4" />
             </Button>
         )}
          
          */}
         
      </SidebarFooter> 


    </Sidebar>
  );
}