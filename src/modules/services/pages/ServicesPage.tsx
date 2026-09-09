// (Archivo MODIFICADO) src/pages/Servicios.tsx
import React, { useState } from 'react';
import { useCan } from '@/auth';
// ¡NUEVO! Importamos los componentes de Pestañas
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { SectionHelp } from "@/shared/components/SectionHelp";
// ¡NUEVO! Importamos los componentes que creamos
import ServiciosIndividuales from '@/modules/services/components/ServiciosIndividuales';
import { ServiciosPaquetes } from '@/modules/packages';

const Servicios: React.FC = () => {
  const { can } = useCan();
  const [selectedTab, setSelectedTab] = useState("servicios");
  const canViewServices = can("services.view");
  const canViewPackages = can("packages.view");
  const activeTab = selectedTab === "servicios" && canViewServices ? "servicios" : selectedTab === "paquetes" && canViewPackages ? "paquetes" : canViewServices ? "servicios" : "paquetes";
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Servicios y Paquetes</h1>
            <SectionHelp title="Acerca de Servicios y Paquetes">
              <p>
                Mantén el catálogo de tratamientos, precios y promociones que ofrece el consultorio.
              </p>
              <p>
                Los servicios y paquetes disponibles se usan al elaborar cotizaciones y registrar ventas.
              </p>
            </SectionHelp>
          </div>
        </div>
        {/* El botón de "Nuevo" se mueve adentro de cada pestaña */}
      </div>

      <Tabs value={activeTab} onValueChange={setSelectedTab} className="min-h-0">
        <TabsList className={`grid w-full max-w-md ${canViewServices && canViewPackages ? "grid-cols-2" : "grid-cols-1"}`}>
          {canViewServices && <TabsTrigger value="servicios">Servicios individuales</TabsTrigger>}
          {canViewPackages && <TabsTrigger value="paquetes">Paquetes</TabsTrigger>}
        </TabsList>
        
        {canViewServices && <TabsContent value="servicios" className="mt-6">
          <ServiciosIndividuales />
        </TabsContent>}
        
        {canViewPackages && <TabsContent value="paquetes" className="mt-6">
          <ServiciosPaquetes />
        </TabsContent>}
      </Tabs>
    </div>
  );
};

export default Servicios;
