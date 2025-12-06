// (Archivo MODIFICADO) src/pages/Servicios.tsx
import React from 'react';
// ¡NUEVO! Importamos los componentes de Pestañas
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// ¡NUEVO! Importamos los componentes que creamos
import ServiciosIndividuales from '@/components/ServiciosIndividuales';
import ServiciosPaquetes from '@/components/ServiciosPaquetes';

const Servicios: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Servicios y Paquetes</h1>
          <p className="text-muted-foreground">Catálogo de servicios dentales y promociones</p>
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