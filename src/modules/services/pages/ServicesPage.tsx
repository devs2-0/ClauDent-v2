// (Archivo MODIFICADO) src/pages/Servicios.tsx
import React from 'react';
// ¡NUEVO! Importamos los componentes de Pestañas
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { SectionHelp } from "@/shared/components/SectionHelp";
// ¡NUEVO! Importamos los componentes que creamos
import ServiciosIndividuales from '@/modules/services/components/ServiciosIndividuales';
import { ServiciosPaquetes } from '@/modules/packages';

const Servicios: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">Servicios y Paquetes</h1>
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

      <Tabs defaultValue="servicios">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="servicios">Servicios Individuales</TabsTrigger>
          <TabsTrigger value="paquetes">Paquetes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="servicios" className="mt-6">
          <ServiciosIndividuales />
        </TabsContent>
        
        <TabsContent value="paquetes" className="mt-6">
          <ServiciosPaquetes />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Servicios;
