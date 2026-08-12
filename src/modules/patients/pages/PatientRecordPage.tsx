import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardPaste,
  CreditCard,
  DollarSign,
  FileText,
  Heart,
  Paperclip,
  User,
} from "lucide-react";
import { motion } from "framer-motion";

import { usePatients } from "@/modules/patients";
import PatientAntecedentes from "@/modules/patients/components/PatientAntecedentes";
import PatientAttachments from "@/modules/patients/components/PatientAttachments";
import PatientData from "@/modules/patients/components/PatientData";
import PatientHistory from "@/modules/patients/components/PatientHistory";
import PatientOdontogram from "@/modules/patients/components/PatientOdontogram";
import PatientPayments from "@/modules/patients/components/PatientPayments";
import PatientQuotations from "@/modules/patients/components/PatientQuotations";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { calculateAge } from "@/shared/utils/utils";

const PatientRecordPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { patients } = usePatients();
  const [activeTab, setActiveTab] = useState("datos");

  const patient = patients.find((item) => item.id === id);
  const patientName = patient ? `${patient.nombres} ${patient.apellidos}`.trim() : "";

  if (!patient) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-muted-foreground">Paciente no encontrado</p>
        <Button onClick={() => navigate("/pacientes")}>Volver a Pacientes</Button>
      </div>
    );
  }

  const tabs = [
    { value: "datos", label: "Datos", icon: User },
    { value: "antecedentes", label: "Antecedentes", icon: ClipboardPaste },
    { value: "historial", label: "Historial", icon: FileText },
    { value: "pagos", label: "Pagos", icon: CreditCard },
    { value: "adjuntos", label: "Adjuntos", icon: Paperclip },
    { value: "odontograma", label: "Odontograma", icon: Heart },
    { value: "cotizaciones", label: "Cotizaciones", icon: DollarSign },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pacientes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">
            {patient.nombres} {patient.apellidos}
          </h1>
          <p className="text-muted-foreground">
            {patient.curp || "N/A"} - {calculateAge(patient.fechaNacimiento)} anos - {patient.estado}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-none border-b-2 border-transparent px-6 py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="p-6">
              <TabsContent value="datos" className="mt-0">
                <PatientData patient={patient} />
              </TabsContent>

              <TabsContent value="antecedentes" className="mt-0">
                <PatientAntecedentes />
              </TabsContent>

              <TabsContent value="historial" className="mt-0">
                <PatientHistory patientId={patient.id} />
              </TabsContent>

              <TabsContent value="pagos" className="mt-0">
                <PatientPayments patientId={patient.id} patientName={patientName} />
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

export default PatientRecordPage;
