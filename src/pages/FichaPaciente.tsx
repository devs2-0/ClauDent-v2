// RF03-RF06: Patient file (¡MODIFICADO! con Pestaña Antecedentes)
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, FileText, Paperclip, Heart, DollarSign, ClipboardPaste } from 'lucide-react'; // ¡NUEVO! ClipboardPaste
import { motion } from 'framer-motion';
import { useApp } from '@/state/AppContext';
import { calculateAge } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PatientData from '@/components/PatientData';
import PatientHistory from '@/components/PatientHistory';
import PatientAttachments from '@/components/PatientAttachments';
import PatientOdontogram from '@/components/PatientOdontogram';
import PatientQuotations from '@/components/PatientQuotations';
import PatientAntecedentes from '@/components/PatientAntecedentes'; // ¡NUEVO!

const FichaPaciente: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { patients } = useApp();
  const [activeTab, setActiveTab] = useState('datos');

  const patient = patients.find((p) => p.id === id);

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Paciente no encontrado</p>
        <Button onClick={() => navigate('/pacientes')}>Volver a Pacientes</Button>
      </div>
    );
  }

  // ¡MODIFICADO! Añadimos la nueva pestaña
  const tabs = [
    { value: 'datos', label: 'Datos', icon: User },
    { value: 'antecedentes', label: 'Antecedentes', icon: ClipboardPaste }, // ¡NUEVO!
    { value: 'historial', label: 'Historial', icon: FileText },
    { value: 'adjuntos', label: 'Adjuntos', icon: Paperclip },
    { value: 'odontograma', label: 'Odontograma', icon: Heart },
    { value: 'cotizaciones', label: 'Cotizaciones', icon: DollarSign },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/pacientes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">
            {patient.nombres} {patient.apellidos}
          </h1>
          <p className="text-muted-foreground">
            {patient.curp || 'N/A'} · {calculateAge(patient.fechaNacimiento)} años · {patient.estado}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="p-6">
              <TabsContent value="datos" className="mt-0">
                <PatientData patient={patient} />
              </TabsContent>
              
              {/* ¡NUEVO! Contenido de la pestaña */}
              <TabsContent value="antecedentes" className="mt-0">
                <PatientAntecedentes />
              </TabsContent>

              <TabsContent value="historial" className="mt-0">
                <PatientHistory patientId={patient.id} />
              </TabsContent>

              <TabsContent value="adjuntos" className="mt-0">
                <PatientAttachments patientId={patient.id} />
              </TabsContent>

              <TabsContent value="odontograma" className="mt-0">
                <PatientOdontogram patientId={patient.id} />
              </TabsContent>

              <TabsContent value="cotizaciones" className="mt-0">
                <PatientQuotations patientId={patient.id} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default FichaPaciente;