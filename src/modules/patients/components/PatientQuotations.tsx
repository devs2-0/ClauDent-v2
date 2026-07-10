// Patient quotations list (ACTUALIZADO A NUEVOS ESTADOS)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Printer } from 'lucide-react';
import { usePatients } from '@/modules/patients';
import { Quotation, useQuotations } from '@/modules/quotations';
import { formatCurrency, formatDate } from '@/shared/utils/utils';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import { generateQuotationPDF } from '@/modules/quotations/services/quotationPdfService';

interface PatientQuotationsProps {
  patientId: string;
}

const PatientQuotations: React.FC<PatientQuotationsProps> = ({ patientId }) => {
  const { patients } = usePatients();
  const { quotations, quotationsLoading, updateQuotation } = useQuotations();
  const [patientQuotations, setPatientQuotations] = useState<Quotation[]>([]);
  
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
     fecha: '',
     estado: '',
     notas: '',
     descuento: '' as string | number
  });

  useEffect(() => {
    if (patientId && quotations.length > 0) {
      const filtered = quotations.filter(q => q.pacienteId === patientId);
      setPatientQuotations(filtered);
    } else {
      setPatientQuotations([]);
    }
  }, [patientId, quotations]);

  const handleEditClick = (quotation: Quotation) => {
      setEditingQuotation(quotation);
      setFormData({
          fecha: quotation.fecha,
          estado: quotation.estado,
          notas: quotation.notas || '',
          descuento: quotation.descuento
      });
      setIsDialogOpen(true);
  };
  
  const handleSave = async () => {
      if(!editingQuotation) return;
      setIsSaving(true);
      try {
          await updateQuotation(editingQuotation.id, {
              fecha: formData.fecha,
              estado: formData.estado as any,
              notas: formData.notas,
              descuento: Number(formData.descuento)
          });
          toast.success("Cotización actualizada");
          setIsDialogOpen(false);
      } catch(e) {
          console.error(e);
          toast.error("Error al actualizar");
      } finally {
          setIsSaving(false);
      }
  };

  const handlePrint = (q: Quotation) => {
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
        <Link to="/cotizaciones">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ir a Gestión Completa
          </Button>
        </Link>
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
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleEditClick(quotation)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Cotización #{quotation.id.substring(0, 6)}...
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
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handlePrint(quotation); }}>
                        <Printer className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mini Dialogo de Edición Rápida */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Editar Estado / Notas</DialogTitle>
                <DialogDescription>Para editar items, ve al módulo de Cotizaciones.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={formData.estado} onValueChange={(v) => setFormData({...formData, estado: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="borrador">Borrador</SelectItem>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea 
                        value={formData.notas} 
                        onChange={(e) => setFormData({...formData, notas: e.target.value})} 
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving}>Guardar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientQuotations;
