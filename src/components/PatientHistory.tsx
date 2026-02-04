// RF03: Patient clinical history (BUSCADOR + EDITABLE + FIX FECHA)
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Check, ChevronsUpDown, X, Edit, Trash2 } from 'lucide-react';
import { useApp, Service } from '@/state/AppContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
// Importaciones de Firebase
import { collection, query, onSnapshot, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HistoryEntry } from '@/state/AppContext';
import { Skeleton } from '@/components/ui/skeleton';
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

interface PatientHistoryProps {
  patientId: string;
}

const PatientHistory: React.FC<PatientHistoryProps> = ({ patientId }) => {
  const { services, addHistoryEntry, updateHistoryEntry, deleteHistoryEntry } = useApp();
  
  const [historial, setHistorial] = useState<HistoryEntry[]>([]);
  const [historialLoading, setHistorialLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  
  // Estado para edición
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    servicios: [] as { servicioId: string; cantidad: number }[],
    notas: '',
  });

  // --- Lógica de Buscador de Servicios ---
  const [openComboboxIndex, setOpenComboboxIndex] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [recentServices, setRecentServices] = useState<Service[]>([]);

  const filteredServiceOptions = useMemo(() => {
    if (!serviceSearch.trim()) return recentServices;
    const searchLower = serviceSearch.toLowerCase();
    return services.filter(s => 
        s.nombre.toLowerCase().includes(searchLower) || 
        (s.codigo && s.codigo.toLowerCase().includes(searchLower))
    ).slice(0, 20);
  }, [services, serviceSearch, recentServices]);

  const handleSelectService = (index: number, service: Service) => {
    const newServicios = [...formData.servicios];
    newServicios[index] = { ...newServicios[index], servicioId: service.id };
    setFormData({ ...formData, servicios: newServicios });
    
    // Agregar a recientes
    setRecentServices(prev => {
        const filtered = prev.filter(s => s.id !== service.id);
        return [service, ...filtered].slice(0, 5);
    });

    setOpenComboboxIndex(null);
    setServiceSearch('');
  };

  // Cargar Historial (Fix Fecha)
  useEffect(() => {
    if (!patientId) return;
    setHistorialLoading(true);
    const historyRef = collection(db, 'pacientes', patientId, 'historial');
    const q = query(historyRef, orderBy('fecha', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const historyData: HistoryEntry[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // CORRECCIÓN DE FECHA: Convertir Timestamp a string ISO
        let fechaIso = '';
        if (data.fecha && data.fecha.toDate) {
            fechaIso = data.fecha.toDate().toISOString().split('T')[0]; // "YYYY-MM-DD"
        } else {
            fechaIso = data.fecha || new Date().toISOString().split('T')[0];
        }

        return {
            id: doc.id,
            ...data,
            fecha: fechaIso,
        } as HistoryEntry;
      });
      setHistorial(historyData);
      setHistorialLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);

  const handleOpenDialog = (entry?: HistoryEntry) => {
    if (entry) {
        setEditingEntryId(entry.id);
        setFormData({
            fecha: entry.fecha,
            servicios: entry.servicios,
            notas: entry.notas || '',
        });
    } else {
        setEditingEntryId(null);
        setFormData({
            fecha: new Date().toISOString().split('T')[0],
            servicios: [],
            notas: '',
        });
    }
    setIsDialogOpen(true);
  };

  const handleAddServiceRow = () => {
    setFormData({
      ...formData,
      servicios: [...formData.servicios, { servicioId: '', cantidad: 1 }],
    });
  };

  const handleRemoveServiceRow = (index: number) => {
    setFormData({
      ...formData,
      servicios: formData.servicios.filter((_, i) => i !== index),
    });
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newServicios = [...formData.servicios];
    newServicios[index] = { ...newServicios[index], cantidad: parseFloat(value) || 0 };
    setFormData({ ...formData, servicios: newServicios });
  };

  const calculateTotal = () => {
    return formData.servicios.reduce((total, item) => {
      const service = services.find((s) => s.id === item.servicioId);
      return total + (service?.precio || 0) * (item.cantidad || 0);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.servicios.length === 0) {
      toast.error('Debe agregar al menos un servicio');
      return;
    }
    if (formData.servicios.some(s => !s.servicioId)) {
        toast.error('Seleccione un servicio para todas las filas');
        return;
    }

    setIsFormLoading(true);
    const payload = {
        fecha: formData.fecha,
        servicios: formData.servicios,
        notas: formData.notas,
        total: calculateTotal(),
    };

    try {
      if (editingEntryId) {
        await updateHistoryEntry(patientId, editingEntryId, payload);
        toast.success('Entrada actualizada');
      } else {
        await addHistoryEntry(patientId, payload);
        toast.success('Entrada agregada');
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar');
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (confirm('¿Eliminar esta entrada del historial?')) {
        try {
            await deleteHistoryEntry(patientId, entryId);
            toast.success('Entrada eliminada');
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar');
        }
    }
  };

  const HistoryLoadingSkeleton = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-36" />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Historial de Procedimientos</h3>
        <Button onClick={() => handleOpenDialog()} disabled={historialLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Entrada
        </Button>
      </div>

      <div className="space-y-4">
        {historialLoading ? (
          <>
            <HistoryLoadingSkeleton />
            <HistoryLoadingSkeleton />
          </>
        ) : historial.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay entradas en el historial. Agrega la primera entrada.
            </CardContent>
          </Card>
        ) : (
          historial.map((entry) => (
            <Card key={entry.id} className="hover:shadow-sm transition-shadow relative group">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base">{formatDate(entry.fecha)}</CardTitle>
                        <CardDescription>Total: {formatCurrency(entry.total)}</CardDescription>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(entry)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">Servicios:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {entry.servicios.map((item, idx) => {
                      const service = services.find((s) => s.id === item.servicioId);
                      return (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {service?.nombre || 'Servicio no encontrado'} x{item.cantidad}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {entry.notas && (
                  <div>
                    <p className="text-sm font-medium mb-1">Notas:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.notas}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingEntryId ? 'Editar Entrada' : 'Nueva Entrada en Historial'}</DialogTitle>
            <DialogDescription>Registra los servicios aplicados al paciente</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4">
            <form id="history-form" onSubmit={handleSubmit} className="space-y-4">
                <fieldset disabled={isFormLoading} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="fecha">Fecha</Label>
                    <Input
                    id="fecha"
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    required
                    />
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                    <Label>Servicios</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddServiceRow}>
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                    </Button>
                    </div>
                    {formData.servicios.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                        
                        {/* BUSCADOR DE SERVICIOS (POPOVER) */}
                        <Popover 
                            open={openComboboxIndex === index} 
                            onOpenChange={(isOpen) => {
                                setOpenComboboxIndex(isOpen ? index : null);
                                if(!isOpen) setServiceSearch('');
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "flex-1 justify-between text-left font-normal",
                                        !item.servicioId && "text-muted-foreground"
                                    )}
                                >
                                    <span className="truncate">
                                        {item.servicioId 
                                            ? services.find(s => s.id === item.servicioId)?.nombre 
                                            : "Buscar servicio..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <CommandInput 
                                        placeholder="Buscar servicio..." 
                                        value={serviceSearch}
                                        onValueChange={setServiceSearch}
                                    />
                                    <CommandList>
                                        {filteredServiceOptions.length === 0 ? (
                                            <CommandEmpty>No encontrado.</CommandEmpty>
                                        ) : (
                                            <CommandGroup heading={serviceSearch ? "Resultados" : "Recientes"}>
                                                {filteredServiceOptions.map((service) => (
                                                    <CommandItem
                                                        key={service.id}
                                                        value={service.nombre}
                                                        onSelect={() => handleSelectService(index, service)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                item.servicioId === service.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex justify-between w-full">
                                                            <span>{service.nombre}</span>
                                                            <span className="text-xs text-muted-foreground">{formatCurrency(service.precio)}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        )}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        
                        {/* Input Cantidad (Decimales permitidos) */}
                        <Input
                            type="number"
                            min="0.01" 
                            step="0.01" 
                            value={item.cantidad}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            className="w-20"
                            placeholder="Cant."
                        />
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => handleRemoveServiceRow(index)}
                        >
                        <X className="h-4 w-4" />
                        </Button>
                    </div>
                    ))}
                    {formData.servicios.length === 0 && <p className="text-sm text-muted-foreground text-center">Agrega servicios.</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notas">Notas</Label>
                    <Textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    rows={4}
                    placeholder="Observaciones, diagnóstico, tratamiento..."
                    />
                </div>

                <div className="flex justify-between items-center p-4 bg-muted rounded-2xl">
                    <span className="font-medium">Total:</span>
                    <span className="text-xl font-bold">{formatCurrency(calculateTotal())}</span>
                </div>
                </fieldset>
            </form>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isFormLoading}>
              Cancelar
            </Button>
            <Button type="submit" form="history-form" disabled={isFormLoading}>
              {isFormLoading ? 'Guardando...' : (editingEntryId ? 'Guardar Cambios' : 'Guardar Entrada')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientHistory;