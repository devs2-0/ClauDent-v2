// RF09: Quotations (EDITABLE Y SIN ERRORES)
import React, { useState, useMemo } from 'react';
import { Plus, Download, Eye, FileText, Book, ClipboardPlus, Search, Printer, Check, ChevronsUpDown, X, Trash2 } from 'lucide-react';
import { useApp, QuotationItem, Quotation, Service } from '@/state/AppContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { generateQuotationPDF } from '@/lib/pdfGenerator'; 
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface FormQuotationItem {
  servicioId: string | null;
  nombre: string;
  cantidad: number | string;       
  precioUnitario: number | string; 
}

const Cotizaciones: React.FC = () => {
  const { quotations, quotationsLoading, patients, services, addQuotation, updateQuotation, deleteQuotation } = useApp();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  
  const [openPatientCombobox, setOpenPatientCombobox] = useState(false);
  const [openServiceIndex, setOpenServiceIndex] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]); 
  const [patientSearch, setPatientSearch] = useState('');

  const [mainSearch, setMainSearch] = useState('');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');

  const [formData, setFormData] = useState({
    pacienteId: '',
    fecha: new Date().toISOString().split('T')[0],
    items: [] as FormQuotationItem[], 
    descuento: '' as string | number, 
    estado: 'borrador' as 'borrador' | 'activo' | 'inactivo',
    notas: '',
  });

  // --- LÓGICA DE FILTRADO ---
  const filteredPatientOptions = useMemo(() => {
    if (!patientSearch.trim()) return recentPatients;
    const searchLower = patientSearch.toLowerCase();
    return patients.filter(p => 
        p.nombres.toLowerCase().includes(searchLower) || 
        p.apellidos.toLowerCase().includes(searchLower) ||
        (p.curp && p.curp.toLowerCase().includes(searchLower))
    ).slice(0, 20);
  }, [patients, patientSearch, recentPatients]);

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

  const handleSelectPatient = (patient: any) => {
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
        
        return matchesText && matchesStart && matchesEnd;
    });
  }, [quotations, patients, mainSearch, dateFilterStart, dateFilterEnd]);

  const handleOpenDialog = (quotation?: Quotation) => {
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
    if (!formData.pacienteId || formData.items.length === 0) {
      toast.error('Debe seleccionar un paciente y agregar al menos un servicio');
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
        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
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
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cotizaciones</h1>
          <p className="text-muted-foreground">Gestiona las cotizaciones de tratamientos</p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Nueva Cotización
        </Button>
      </div>

      {/* Buscador y Filtros */}
      <div className="flex flex-col md:flex-row gap-4 items-end shrink-0">
        <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por paciente, fecha o estado..."
              value={mainSearch}
              onChange={(e) => setMainSearch(e.target.value)}
              className="pl-10"
            />
        </div>
        <div className="flex gap-2 items-center">
            <div className="grid gap-1.5">
                <Label htmlFor="dateStart" className="text-xs">Desde</Label>
                <Input 
                    id="dateStart"
                    type="date" 
                    value={dateFilterStart} 
                    onChange={(e) => setDateFilterStart(e.target.value)}
                    className="w-36" 
                />
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="dateEnd" className="text-xs">Hasta</Label>
                <Input 
                    id="dateEnd"
                    type="date" 
                    value={dateFilterEnd} 
                    onChange={(e) => setDateFilterEnd(e.target.value)}
                    className="w-36" 
                />
            </div>
            {(dateFilterStart || dateFilterEnd) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFilterStart(''); setDateFilterEnd(''); }} className="mb-0.5">
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="whitespace-nowrap">ID</TableHead>
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
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No hay cotizaciones encontradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotations.map((quotation) => {
                    const patient = patients.find((p) => p.id === quotation.pacienteId);
                    return (
                      <TableRow key={quotation.id}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">#{quotation.id.substring(0, 6)}...</TableCell>
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
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                aria-label="Ver/Editar detalle"
                                onClick={() => handleOpenDialog(quotation)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleExportPDF(quotation.id)}
                              aria-label="Exportar PDF"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(quotation.id)}
                              aria-label="Eliminar Cotización"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingQuotationId ? 'Editar Cotización' : 'Nueva Cotización'}</DialogTitle>
            <DialogDescription>
                Detalles de la cotización.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <form id="quotation-form" onSubmit={handleSubmit} className="space-y-4 py-4 pb-8">
                <fieldset disabled={isFormLoading} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="flex flex-col space-y-2">
                      <Label>Paciente *</Label>
                      <Popover open={openPatientCombobox} onOpenChange={setOpenPatientCombobox}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openPatientCombobox}
                            className="w-full justify-between"
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
                        <PopoverContent className="w-[400px] p-0">
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
                                    <CommandGroup heading={patientSearch ? "Resultados" : "Recientes"}>
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

                    <div className="space-y-2">
                    <Label htmlFor="fecha">Fecha</Label>
                    <Input
                        id="fecha"
                        type="date"
                        value={formData.fecha}
                        onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                    <Label>Servicios</Label>
                    <div className="flex gap-2">
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
                            step="0.01" 
                            value={item.precioUnitario}
                            onChange={(e) => handleItemChange(index, 'precioUnitario', e.target.value)}
                            className="w-32"
                            placeholder="Precio"
                            />
                        </>
                        )}
                        
                        <Input
                        type="number"
                        min="0.01" 
                        step="0.01" 
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
                    
                    {formData.items.length === 0 && <p className="text-sm text-muted-foreground text-center">Agrega servicios a la cotización.</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label htmlFor="descuento">Descuento (%)</Label>
                    <Input
                        id="descuento"
                        type="number"
                        min="0"
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

          <div className="p-4 bg-muted rounded-t-xl border-t">
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