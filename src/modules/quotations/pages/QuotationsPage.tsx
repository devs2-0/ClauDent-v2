// RF09: Quotations (EDITABLE Y SIN ERRORES)
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Eye, Book, ClipboardPlus, Search, Printer, Check, ChevronsUpDown, X, Trash2 } from 'lucide-react';
import { type Patient, usePatients } from '@/modules/patients';
import { Quotation, QuotationItem, useQuotations } from '@/modules/quotations';
import { Service, useDentalServices } from '@/modules/services';
import { formatCurrency, formatDate } from '@/shared/utils/utils';
import { Button } from '@/shared/components/ui/button';
import { SectionHelp } from '@/shared/components/SectionHelp';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { generateQuotationPDF } from '@/modules/quotations/services/quotationPdfService'; 
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover"
import { cn } from "@/shared/utils/utils"
import { useCan } from '@/auth';

interface FormQuotationItem {
  servicioId: string | null;
  nombre: string;
  cantidad: number | string;       
  precioUnitario: number | string; 
}

type QuotationStatusFilter = 'all' | 'borrador' | 'activo' | 'inactivo';
type QuotationSortOrder = 'date_desc' | 'patient_asc';
const Cotizaciones: React.FC = () => {
  const { can, loading: permissionsLoading } = useCan();
  const [searchParams, setSearchParams] = useSearchParams();
  const { patients } = usePatients();
  const { services } = useDentalServices();
  const { quotations, quotationsLoading, addQuotation, updateQuotation, deleteQuotation } = useQuotations();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  
  const [openPatientCombobox, setOpenPatientCombobox] = useState(false);
  const [openServiceIndex, setOpenServiceIndex] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');

  const [mainSearch, setMainSearch] = useState('');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuotationStatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<QuotationSortOrder>('date_desc');
  const canCreateQuotation = can('quotations.create');

  const [formData, setFormData] = useState({
    pacienteId: '',
    fecha: new Date().toISOString().split('T')[0],
    items: [] as FormQuotationItem[], 
    descuento: '' as string | number, 
    estado: 'borrador' as 'borrador' | 'activo' | 'inactivo',
    notas: '',
  });

  // --- LÓGICA DE FILTRADO ---
  const suggestedPatients = useMemo(() => {
    const selectedIds = new Set(recentPatients.map((patient) => patient.id));
    const newestPatients = [...patients]
      .sort((first, second) => second.fechaRegistro.localeCompare(first.fechaRegistro))
      .filter((patient) => !selectedIds.has(patient.id));

    return [...recentPatients, ...newestPatients].slice(0, 5);
  }, [patients, recentPatients]);

  const filteredPatientOptions = useMemo(() => {
    if (!patientSearch.trim()) return suggestedPatients;
    const searchLower = patientSearch.toLowerCase();
    return patients.filter(p =>
        p.nombres.toLowerCase().includes(searchLower) ||
        p.apellidos.toLowerCase().includes(searchLower) ||
        (p.curp && p.curp.toLowerCase().includes(searchLower))
    ).slice(0, 20);
  }, [patients, patientSearch, suggestedPatients]);

  const filteredServiceOptions = useMemo(() => {
    if (!serviceSearch.trim()) return recentServices;
    const searchLower = serviceSearch.toLowerCase();
    return services
        .filter(s => 
            s.nombre.toLowerCase().includes(searchLower) || 
            (s.codigo && s.codigo.toLowerCase().includes(searchLower))
        )
        .slice(0, 20);
  }, [services, serviceSearch, recentServices]);

  const handleSelectPatient = (patient: Patient) => {
      setFormData({ ...formData, pacienteId: patient.id });
      setRecentPatients(prev => {
          const filtered = prev.filter(p => p.id !== patient.id);
          return [patient, ...filtered].slice(0, 5);
      });
      setOpenPatientCombobox(false);
      setPatientSearch('');
  };

  const handleSelectService = (index: number, service: Service) => {
    const newItems = [...formData.items];
    newItems[index] = {
        ...newItems[index],
        servicioId: service.id,
        nombre: service.nombre,
        precioUnitario: service.precio
    };
    setFormData({ ...formData, items: newItems });
    setRecentServices(prev => {
        const filtered = prev.filter(s => s.id !== service.id);
        return [service, ...filtered].slice(0, 5);
    });
    setOpenServiceIndex(null);
    setServiceSearch('');
  };

  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
        const patient = patients.find(p => p.id === q.pacienteId);
        const patientName = patient ? `${patient.nombres} ${patient.apellidos}` : '';
        const searchLower = mainSearch.toLowerCase();
        
        const matchesText = patientName.toLowerCase().includes(searchLower) || 
                            q.estado.includes(searchLower);

        const qDate = q.fecha;
        const matchesStart = dateFilterStart ? qDate >= dateFilterStart : true;
        const matchesEnd = dateFilterEnd ? qDate <= dateFilterEnd : true;
        const matchesStatus = statusFilter === 'all' || q.estado === statusFilter;

        return matchesText && matchesStart && matchesEnd && matchesStatus;
    }).sort((first, second) => {
        if (sortOrder === 'patient_asc') {
          const firstPatient = patients.find(patient => patient.id === first.pacienteId);
          const secondPatient = patients.find(patient => patient.id === second.pacienteId);
          const firstName = firstPatient ? `${firstPatient.nombres} ${firstPatient.apellidos}` : '';
          const secondName = secondPatient ? `${secondPatient.nombres} ${secondPatient.apellidos}` : '';
          return firstName.localeCompare(secondName, 'es', { sensitivity: 'base' });
        }

        return second.fecha.localeCompare(first.fecha);
    });
  }, [quotations, patients, mainSearch, dateFilterStart, dateFilterEnd, statusFilter, sortOrder]);
  const handleOpenDialog = (quotation?: Quotation) => {
    if (!can(quotation ? "quotations.update" : "quotations.create")) return;
    if (quotation) {
        setEditingQuotationId(quotation.id);
        setFormData({
            pacienteId: quotation.pacienteId,
            fecha: quotation.fecha,
            items: quotation.items, 
            descuento: quotation.descuento.toString(),
            estado: quotation.estado,
            notas: quotation.notas || '',
        });
    } else {
        setEditingQuotationId(null);
        setFormData({
            pacienteId: '',
            fecha: new Date().toISOString().split('T')[0],
            items: [],
            descuento: '',
            estado: 'borrador',
            notas: '',
        });
    }
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (searchParams.get('action') !== 'newQuotation') return;
    if (permissionsLoading) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('action');
    setSearchParams(nextSearchParams, { replace: true });

    if (!canCreateQuotation) return;

    setEditingQuotationId(null);
    setFormData({
      pacienteId: '',
      fecha: new Date().toISOString().split('T')[0],
      items: [],
      descuento: '',
      estado: 'borrador',
      notas: '',
    });
    setIsDialogOpen(true);
  }, [canCreateQuotation, permissionsLoading, searchParams, setSearchParams]);

  const handleAddCatalogoItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { servicioId: '', nombre: '', cantidad: 1, precioUnitario: 0 } 
      ],
    });
  };

  const handleAddPersonalizadoItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { servicioId: null, nombre: '', cantidad: 1, precioUnitario: '' }
      ],
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleItemChange = (index: number, field: keyof FormQuotationItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountValue = Number(formData.descuento) || 0;
    const descuentoAmount = (subtotal * discountValue) / 100;
    return subtotal - descuentoAmount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can(editingQuotationId ? "quotations.update" : "quotations.create")) return;
    if (!formData.pacienteId || !formData.fecha || formData.items.length === 0) {
      toast.error('Selecciona paciente, fecha y al menos un servicio');
      return;
    }
    
    setIsFormLoading(true);
    
    const finalDiscount = Number(formData.descuento) || 0;
    const finalItems: QuotationItem[] = formData.items.map(item => ({
        servicioId: item.servicioId,
        nombre: item.nombre,
        cantidad: Number(item.cantidad) || 0,
        precioUnitario: Number(item.precioUnitario) || 0
    }));

    const payload = {
        pacienteId: formData.pacienteId,
        fecha: formData.fecha,
        items: finalItems,
        descuento: finalDiscount,
        total: calculateTotal(),
        estado: formData.estado,
        notas: formData.notas,
    };

    try {
      if (editingQuotationId) {
        await updateQuotation(editingQuotationId, payload);
        toast.success('Cotización actualizada');
      } else {
        await addQuotation(payload);
        toast.success('Cotización creada');
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar la cotización');
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!can("quotations.delete")) return;
    if (confirm('¿Está seguro de eliminar esta cotización?')) {
      try {
        await deleteQuotation(id);
        toast.success('Cotización eliminada');
      } catch (error) {
        console.error(error);
        toast.error('Error al eliminar la cotización');
      }
    }
  };

  const handleExportPDF = (quotationId: string) => {
    if (!can("quotations.pdf.generate")) return;
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) {
      toast.error("No se encontró la cotización.");
      return;
    }
    const patient = patients.find(p => p.id === quotation.pacienteId);
    try {
      generateQuotationPDF(quotation, patient);
    } catch (error) {
      console.error("Error al generar PDF: ", error);
      toast.error("Error al generar el PDF");
    }
  };

  const estadoBadgeVariant = (estado: string) => {
    switch (estado) {
      case 'activo': return 'default';
      case 'inactivo': return 'secondary';
      case 'borrador': return 'outline';
      default: return 'outline';
    }
  };

  const TableLoadingSkeleton = () => (
    Array(3).fill(0).map((_, index) => (
      <TableRow key={index}>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </TableCell>
      </TableRow>
    ))
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Cotizaciones</h1>
            <SectionHelp title="Acerca de Cotizaciones">
              <p>
                Crea, consulta y actualiza presupuestos de tratamientos para cada paciente.
              </p>
              <p>
                Desde aquí puedes revisar sus conceptos, estado y generar el documento para compartirlo.
              </p>
            </SectionHelp>
          </div>
        </div>
        {canCreateQuotation && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Cotización
          </Button>
        )}
      </div>

      <div className="grid shrink-0 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
        <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
            <Label htmlFor="quotation-search" className="text-xs">Paciente</Label>
            <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="quotation-search"
              placeholder="Buscar paciente..."
              value={mainSearch}
              onChange={(e) => setMainSearch(e.target.value)}
              className="h-9 pl-9"
            />
            </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quotation-status" className="text-xs">Estado</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as QuotationStatusFilter)}>
            <SelectTrigger id="quotation-status" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quotation-sort" className="text-xs">Orden</Label>
          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as QuotationSortOrder)}>
            <SelectTrigger id="quotation-sort" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Fecha: más reciente</SelectItem>
              <SelectItem value="patient_asc">Paciente: A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dateStart" className="text-xs">Desde</Label>
          <Input
            id="dateStart"
            type="date"
            value={dateFilterStart}
            onChange={(e) => setDateFilterStart(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dateEnd" className="text-xs">Hasta</Label>
          <Input
            id="dateEnd"
            type="date"
            value={dateFilterEnd}
            onChange={(e) => setDateFilterEnd(e.target.value)}
            className="h-9"
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-9 justify-start xl:justify-center"
          disabled={!mainSearch && !dateFilterStart && !dateFilterEnd && statusFilter === 'all' && sortOrder === 'date_desc'}
          onClick={() => {
            setMainSearch('');
            setDateFilterStart('');
            setDateFilterEnd('');
            setStatusFilter('all');
            setSortOrder('date_desc');
          }}
        >
          <X className="mr-2 h-4 w-4" />
          Limpiar
        </Button>
      </div>

      <Card className="relative isolate z-0 flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="relative isolate z-0 h-full overflow-auto overscroll-contain">
            <Table>
              <TableHeader className="sticky top-0 z-[1] bg-card shadow-sm">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Paciente</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead className="whitespace-nowrap">Servicios</TableHead>
                  <TableHead className="whitespace-nowrap">Total</TableHead>
                  <TableHead className="whitespace-nowrap">Estado</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotationsLoading ? (
                  <TableLoadingSkeleton />
                ) : filteredQuotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No hay cotizaciones encontradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotations.map((quotation) => {
                    const patient = patients.find((p) => p.id === quotation.pacienteId);
                    return (
                      <TableRow key={quotation.id}>
                        <TableCell className="whitespace-nowrap">
                          {patient ? `${patient.nombres} ${patient.apellidos}` : 'Paciente eliminado'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(quotation.fecha)}</TableCell>
                        <TableCell className="whitespace-nowrap">{quotation.items.length} servicio(s)</TableCell>
                        <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(quotation.total)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={estadoBadgeVariant(quotation.estado)}>
                            {quotation.estado.charAt(0).toUpperCase() + quotation.estado.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            {can("quotations.update") && (<Button
                                variant="ghost" 
                                size="icon" 
                                aria-label="Ver/Editar detalle"
                                onClick={() => handleOpenDialog(quotation)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>)}
                            {can("quotations.pdf.generate") && (<Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleExportPDF(quotation.id)}
                              aria-label="Exportar PDF"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>)}
                            {can("quotations.delete") && (<Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(quotation.id)}
                              aria-label="Eliminar Cotización"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen && can(editingQuotationId ? "quotations.update" : "quotations.create")} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingQuotationId ? 'Editar Cotización' : 'Nueva Cotización'}</DialogTitle>
            <DialogDescription>
                Detalles de la cotización.
            </DialogDescription>
          </DialogHeader>
          
          <div className="-mx-6 flex-1 overflow-y-auto px-6">
            <form id="quotation-form" onSubmit={handleSubmit} className="space-y-4 py-3 pb-8">
                <fieldset disabled={isFormLoading} className="space-y-4">
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">

                    <div className="grid gap-2">
                      <Label htmlFor="quotation-patient" className="h-5 leading-5">Paciente *</Label>
                      <Popover open={openPatientCombobox} onOpenChange={setOpenPatientCombobox}>
                        <PopoverTrigger asChild>
                          <Button
                            id="quotation-patient"
                            variant="outline"
                            role="combobox"
                            aria-expanded={openPatientCombobox}
                            className="h-10 w-full justify-between px-3 font-normal"
                          >
                            {formData.pacienteId
                              ? (() => {
                                  const p = patients.find((patient) => patient.id === formData.pacienteId);
                                  return p ? `${p.nombres} ${p.apellidos}` : "Seleccionar paciente...";
                                })()
                              : "Seleccionar paciente..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
                          <Command>
                            <CommandInput 
                                placeholder="Buscar paciente..." 
                                value={patientSearch}
                                onValueChange={setPatientSearch}
                            />
                            <CommandList>
                                {filteredPatientOptions.length === 0 ? (
                                    <CommandEmpty>No se encontró paciente.</CommandEmpty>
                                ) : (
                                    <CommandGroup heading={patientSearch ? "Resultados" : "Pacientes recientes"}>
                                        <ScrollArea className="h-64">
                                        {filteredPatientOptions.map((patient) => (
                                            <CommandItem
                                            key={patient.id}
                                            value={`${patient.nombres} ${patient.apellidos}`}
                                            onSelect={() => handleSelectPatient(patient)}
                                            >
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                formData.pacienteId === patient.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex flex-col">
                                                <span>{patient.nombres} {patient.apellidos}</span>
                                                <span className="text-xs text-muted-foreground">{patient.curp}</span>
                                            </div>
                                            </CommandItem>
                                        ))}
                                        </ScrollArea>
                                    </CommandGroup>
                                )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="fecha" className="h-5 leading-5">Fecha *</Label>
                      <Input
                        id="fecha"
                        type="date"
                        required
                        value={formData.fecha}
                        onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                        className="h-10"
                      />
                    </div>
                </div>

                {!formData.pacienteId && suggestedPatients.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Pacientes recientes:</span>
                    {suggestedPatients.slice(0, 3).map((patient) => (
                      <Button
                        key={patient.id}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 max-w-40 truncate px-2 text-xs"
                        onClick={() => handleSelectPatient(patient)}
                      >
                        <span className="truncate">{patient.nombres} {patient.apellidos}</span>
                      </Button>
                    ))}
                  </div>
                )}
                {!formData.pacienteId && suggestedPatients.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay pacientes registrados.</p>
                )}

                <div className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4" aria-required="true">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Label>Servicios *</Label>
                        <p className="text-xs text-muted-foreground">Agrega conceptos del catálogo o personalizados.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={handleAddCatalogoItem}>
                          <Book className="h-4 w-4 mr-1" />
                          Catálogo
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={handleAddPersonalizadoItem}>
                          <ClipboardPlus className="h-4 w-4 mr-1" />
                          Personalizado
                          </Button>
                      </div>
                    </div>
                    
                    {formData.items.map((item, index) => (
                    <div key={index} className="flex flex-wrap gap-2 items-center border p-2 rounded-md bg-muted/20">
                        {item.servicioId !== null ? (
                          
                          <Popover 
                            open={openServiceIndex === index} 
                            onOpenChange={(isOpen) => {
                                setOpenServiceIndex(isOpen ? index : null);
                                if(!isOpen) setServiceSearch('');
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "flex-[2] min-w-[200px] justify-between",
                                  !item.nombre && "text-muted-foreground"
                                )}
                              >
                                {item.nombre || "Buscar servicio..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput 
                                    placeholder="Escribe para buscar..." 
                                    value={serviceSearch}
                                    onValueChange={setServiceSearch}
                                />
                                <CommandList>
                                    {filteredServiceOptions.length === 0 ? (
                                        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                                    ) : (
                                        <CommandGroup heading={serviceSearch ? "Resultados" : "Recientes"}>
                                            {filteredServiceOptions.map((service) => (
                                            <CommandItem
                                                key={service.id}
                                                value={service.nombre}
                                                onSelect={() => handleSelectService(index, service)}
                                            >
                                                <div className="flex justify-between w-full items-center">
                                                    <span>{service.nombre}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        {formatCurrency(service.precio)}
                                                    </span>
                                                </div>
                                                <Check
                                                className={cn(
                                                    "ml-auto h-4 w-4",
                                                    item.servicioId === service.id ? "opacity-100" : "opacity-0"
                                                )}
                                                />
                                            </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                        ) : (
                        <>
                            <Input
                            type="text"
                            value={item.nombre}
                            onChange={(e) => handleItemChange(index, 'nombre', e.target.value)}
                            placeholder="Nombre servicio personalizado"
                            className="flex-[2] min-w-[200px]"
                            />
                            <Input
                            type="number"
                            min="0"
                            step="0.1" 
                            value={item.precioUnitario}
                            onChange={(e) => handleItemChange(index, 'precioUnitario', e.target.value)}
                            className="w-32"
                            placeholder="Precio"
                            />
                        </>
                        )}
                        
                        <Input
                        type="number"
                        min="1" 
                        step="1" 
                        value={item.cantidad}
                        onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                        className="w-20"
                        placeholder="Cant."
                        />
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleRemoveItem(index)}>
                        <X className="h-4 w-4" />
                        </Button>
                    </div>
                    ))}
                    
                    {formData.items.length === 0 && (
                      <p className="rounded-lg border border-dashed bg-background/60 py-6 text-center text-sm text-muted-foreground">
                        Aún no hay servicios agregados.
                      </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label htmlFor="descuento">Descuento (%)</Label>
                    <Input
                        id="descuento"
                        type="number"
                        min="0"
                        step="0.1" 
                        max="100"
                        placeholder="0"
                        value={formData.descuento}
                        onChange={(e) => setFormData({ ...formData, descuento: e.target.value })}
                    />
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v as any })}>
                        <SelectTrigger id="estado">
                        <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="borrador">Borrador</SelectItem>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notas">Notas Adicionales</Label>
                    <Textarea
                    id="notas"
                    placeholder="Ej: Oferta válida por 15 días..."
                    rows={3}
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    />
                </div>
                </fieldset>
            </form>
          </div>

          <div className="rounded-t-xl border-t bg-muted p-4">
                <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                {formData.descuento !== '' && Number(formData.descuento) > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                    <span>Descuento ({formData.descuento}%):</span>
                    <span>-{formatCurrency((calculateSubtotal() * Number(formData.descuento)) / 100)}</span>
                </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>{formatCurrency(calculateTotal())}</span>
                </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isFormLoading}>
              Cancelar
            </Button>
            <Button type="submit" form="quotation-form" disabled={isFormLoading}>
              {isFormLoading ? 'Guardando...' : (editingQuotationId ? 'Actualizar' : 'Crear Cotización')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cotizaciones;
