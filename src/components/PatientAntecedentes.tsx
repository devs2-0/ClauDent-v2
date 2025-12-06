// (Archivo MODIFICADO) src/components/PatientAntecedentes.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp, IHistoriaClinicaCompleta, initialState } from '@/state/AppContext';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Edit } from 'lucide-react';

import InitialHistoryModal from '@/components/InitialHistoryModal';

// ¡CORREGIDO! Componente DataViewer
const DataViewer: React.FC<{ data: Record<string, any>, title: string }> = ({ data, title }) => {
  // ¡CORREGIDO! El filtro ahora solo oculta 'null' o 'undefined',
  // pero SÍ permite 'false' (para los checkbox) y '""' (para texto vacío).
  const entries = Object.entries(data).filter(([_, value]) => value !== null && value !== undefined);

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">{title}: No hay datos registrados.</p>
      </div>
    );
  }

  // ¡NUEVO! Función para mostrar el valor correctamente
  const getDisplayValue = (value: any): string => {
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    if (value === '') {
      return 'N/A'; // Mostramos N/A para campos de texto vacíos
    }
    return value.toString();
  };

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <span className="text-xs font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
          {/* ¡CORREGIDO! Usamos la nueva función para mostrar el valor */}
          <span className="text-sm font-semibold">
            {getDisplayValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const PatientAntecedentes: React.FC = () => {
  const { id: patientId } = useParams<{ id: string }>();
  const [historyData, setHistoryData] = useState<IHistoriaClinicaCompleta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ¡MODIFICADO! Este useEffect ahora mapea correctamente los IDs de la BD
  useEffect(() => {
    if (!patientId) return;

    const fetchHistoryData = async () => {
      setIsLoading(true);
      try {
        const historyRef = collection(db, 'pacientes', patientId, 'historia_clinica');
        const querySnapshot = await getDocs(historyRef);
        
        let fullData: IHistoriaClinicaCompleta = JSON.parse(JSON.stringify(initialState)); // Copia profunda
        
        if (querySnapshot.empty) {
          console.log("No hay historia clínica inicial para este paciente.");
          // Se quedará con 'initialState' (vacío)
        } else {
          // ¡CORREGIDO! Mapeamos los IDs (snake_case Y camelCase) a las llaves (camelCase)
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            switch (doc.id) {
              case 'historiaGeneral':
              case 'datos_generales':
                fullData.historiaGeneral = { ...initialState.historiaGeneral, ...data };
                break;
              case 'antecedentesHereditarios':
              case 'antecedentes_hereditarios':
                fullData.antecedentesHereditarios = { ...initialState.antecedentesHereditarios, ...data };
                break;
              case 'appPatologicos':
              case 'antecedentes_patologicos':
                fullData.appPatologicos = { ...initialState.appPatologicos, ...data };
                break;
              case 'apnp':
              case 'antecedentes_no_patologicos':
                fullData.apnp = { ...initialState.apnp, ...data };
                break;
              case 'alergias':
              case 'antecedentes_alergicos':
                fullData.alergias = { ...initialState.alergias, ...data };
                break;
              case 'hospitalizaciones':
                fullData.hospitalizaciones = { ...initialState.hospitalizaciones, ...data };
                break;
              case 'signosVitales':
              case 'signos_vitales':
                fullData.signosVitales = { ...initialState.signosVitales, ...data };
                break;
              case 'exploracionCabezaCuello':
              case 'exploracion_cabeza_cuello':
                fullData.exploracionCabezaCuello = { ...initialState.exploracionCabezaCuello, ...data };
                break;
              case 'exploracionAtm':
              case 'exploracion_atm':
                fullData.exploracionAtm = { ...initialState.exploracionAtm, ...data };
                break;

              case 'cavidadOral':
              case 'cavidad_oral':
                fullData.cavidadOral = { ...initialState.cavidadOral, ...data };
                break;
            }
          });
        }
        setHistoryData(fullData);
      } catch (error) {
        console.error("Error al cargar antecedentes: ", error);
        toast.error("Error al cargar los antecedentes del paciente.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoryData();
  // Recargamos cuando se cierra el modal
  }, [patientId, isModalOpen]); 

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  
  if (!historyData) {
     return <p>No se pudieron cargar los datos.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Antecedentes y Ficha Clínica</h3>
        <Button onClick={() => setIsModalOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Editar Antecedentes
        </Button>
      </div>

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>1. Datos Generales (Historia Clínica)</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.historiaGeneral} title="Datos Generales" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>2. Antecedentes Hereditarios</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.antecedentesHereditarios} title="Antecedentes Hereditarios" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>3. Antecedentes Personales Patológicos</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.appPatologicos} title="Antecedentes Patológicos" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-4">
          <AccordionTrigger>4. Antecedentes Personales No Patológicos</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.apnp} title="Antecedentes No Patológicos" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-5">
          <AccordionTrigger>5. Antecedentes Alérgicos</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.alergias} title="Antecedentes Alérgicos" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-6">
          <AccordionTrigger>6. Hospitalizaciones</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.hospitalizaciones} title="Hospitalizaciones" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-7">
          <AccordionTrigger>7. Signos Vitales</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.signosVitales} title="Signos Vitales" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-8">
          <AccordionTrigger>8. Exploración de Cabeza y Cuello</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.exploracionCabezaCuello} title="Exploración Cabeza y Cuello" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-9">
          <AccordionTrigger>9. Exploración de ATM</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.exploracionAtm} title="Exploración ATM" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-10">
          <AccordionTrigger>10. Exploración de Cavidad Oral</AccordionTrigger>
          <AccordionContent>
            <DataViewer data={historyData.cavidadOral} title="Exploración Cavidad Oral" />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* El Modal para Editar */}
      {patientId && (
        <InitialHistoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          patientId={patientId}
          initialData={historyData} 
        />
      )}
    </div>
  );
};

export default PatientAntecedentes;