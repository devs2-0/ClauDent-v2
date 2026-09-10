// Patient quotations list (ACTUALIZADO A NUEVOS ESTADOS)
import { Can, useCan } from '@/auth';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Edit, FileText, Plus, Printer } from 'lucide-react';
import { usePatients } from '@/modules/patients';
import { Quotation, useQuotations } from '@/modules/quotations';
import { formatCurrency, formatDate } from '@/shared/utils/utils';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { generateQuotationPDF } from '@/modules/quotations/services/quotationPdfService';

interface PatientQuotationsProps {
  patientId: string;
}

const PatientQuotations: React.FC<PatientQuotationsProps> = ({ patientId }) => {
  const { can } = useCan();
  const navigate = useNavigate();
  const { patients } = usePatients();
  const { quotations, quotationsLoading } = useQuotations();
  const [patientQuotations, setPatientQuotations] = useState<Quotation[]>([]);

  useEffect(() => {
    if (patientId && quotations.length > 0) {
      const filtered = quotations.filter(q => q.pacienteId === patientId);
      setPatientQuotations(filtered);
    } else {
      setPatientQuotations([]);
    }
  }, [patientId, quotations]);

  const handleEditClick = (quotation: Quotation) => {
    if (!can("quotations.update")) return;
    navigate("/cotizaciones", {
      state: {
        editQuotationId: quotation.id,
        returnTo: `/pacientes/${patientId}`,
      },
    });
  };

  const handlePrint = (q: Quotation) => {
      if (!can("quotations.pdf.generate")) return;
      const patient = patients.find(p => p.id === q.pacienteId);
      generateQuotationPDF(q, patient);
  }

  // ¡MODIFICADO! Nuevos estados
  const estadoBadgeVariant = (estado: string) => {
    switch (estado) {
      case 'activo': return 'default'; // Verde/Primary
      case 'inactivo': return 'secondary'; // Gris
      case 'borrador': return 'outline'; // Borde
      default: return 'outline';
    }
  };

  const QuotationLoadingSkeleton = () => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24 mt-2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-24" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Cotizaciones del Paciente</h3>
        <Can permission="quotations.create"><Link to="/cotizaciones">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ir a Gestión Completa
          </Button>
        </Link></Can>
      </div>

      {quotationsLoading ? (
        <div className="space-y-4">
          <QuotationLoadingSkeleton />
          <QuotationLoadingSkeleton />
        </div>
      ) : patientQuotations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay cotizaciones para este paciente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {patientQuotations.map((quotation) => (
            <Card 
                key={quotation.id} 
                className={can("quotations.update") ? "cursor-pointer transition-shadow hover:shadow-md" : undefined}
                onClick={can("quotations.update") ? () => handleEditClick(quotation) : undefined}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Cotización
                    </CardTitle>
                    <CardDescription>{formatDate(quotation.fecha)}</CardDescription>
                  </div>
                  <Badge variant={estadoBadgeVariant(quotation.estado)}>
                    {quotation.estado.charAt(0).toUpperCase() + quotation.estado.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {quotation.items.length} servicio(s)
                    {quotation.descuento > 0 && ` · ${quotation.descuento}% descuento`}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xl font-bold text-foreground">
                        {formatCurrency(quotation.total)}
                    </div>
                    <Can permission="quotations.pdf.generate"><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handlePrint(quotation); }}>
                        <Printer className="h-4 w-4 text-muted-foreground" />
                    </Button></Can>
                    <Can permission="quotations.update"><Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEditClick(quotation);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button></Can>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
};

export default PatientQuotations;
