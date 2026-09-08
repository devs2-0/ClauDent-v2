import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardPaste,
  CreditCard,
  DollarSign,
  FileText,
  Heart,
  Trash2,
  User,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { useCan } from "@/auth";
import { usePatients } from "@/modules/patients";
import PatientAntecedentes from "@/modules/patients/components/PatientAntecedentes";
import PatientData from "@/modules/patients/components/PatientData";
import PatientHistory from "@/modules/patients/components/PatientHistory";
import PatientOdontogram from "@/modules/patients/components/PatientOdontogram";
import PatientPayments from "@/modules/patients/components/PatientPayments";
import PatientQuotations from "@/modules/patients/components/PatientQuotations";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useConfirmAction } from "@/shared/hooks/useConfirmAction";
import {
  calculatePatientAge,
  getPatientSexLabel,
} from "@/modules/patients/utils/patientUi";

const PatientRecordPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { patients, updatePatient } = usePatients();
  const { can } = useCan();
  const { confirm, confirmationDialog } = useConfirmAction();
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
    { value: "odontograma", label: "Odontograma", icon: Heart },
    { value: "cotizaciones", label: "Cotizaciones", icon: DollarSign },
    { value: "pagos", label: "Pagos", icon: CreditCard },
  ];
  const patientAge = calculatePatientAge(patient.fechaNacimiento);
  const patientDetails = [
    getPatientSexLabel(patient.sexo),
    patient.estado.charAt(0).toUpperCase() + patient.estado.slice(1),
    patientAge === null ? "Sin fecha de nacimiento" : `${patientAge} años`,
  ];
  const registrationParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(patient.fechaRegistro || "");
  const registrationLabel = registrationParts
    ? new Date(
        Number(registrationParts[1]),
        Number(registrationParts[2]) - 1,
        Number(registrationParts[3]),
      ).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  const handleRemovePatient = async () => {
    const confirmed = await confirm({
      title: "Eliminar paciente",
      description: `${patientName} dejará de aparecer entre los pacientes activos. Sus datos e historial se conservarán.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await updatePatient(patient.id, { estado: "inactivo" });
      toast.success("Paciente eliminado del listado activo");
      navigate("/pacientes");
    } catch {
      toast.error("No fue posible eliminar al paciente.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pacientes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold text-foreground sm:text-3xl">
            {patient.nombres} {patient.apellidos}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patientDetails.join(" · ")}
          </p>
          {registrationLabel && (
            <Badge variant="outline" className="mt-2 font-normal text-muted-foreground">
              Registrado: {registrationLabel}
            </Badge>
          )}
        </div>
        {can("patients.delete") && patient.estado === "activo" && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => void handleRemovePatient()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        )}
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
                    className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-5"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="p-4 sm:p-6">
              <TabsContent value="datos" className="mt-0">
                <PatientData patient={patient} />
              </TabsContent>

              <TabsContent value="antecedentes" className="mt-0">
                <PatientAntecedentes />
              </TabsContent>

              <TabsContent value="historial" className="mt-0">
                <PatientHistory patientId={patient.id} />
              </TabsContent>

              <TabsContent value="odontograma" className="mt-0">
                <PatientOdontogram patientId={patient.id} />
              </TabsContent>

              <TabsContent value="cotizaciones" className="mt-0">
                <PatientQuotations patientId={patient.id} />
              </TabsContent>

              <TabsContent value="pagos" className="mt-0">
                <PatientPayments patientId={patient.id} patientName={patientName} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
      {confirmationDialog}
    </motion.div>
  );
};

export default PatientRecordPage;
