// src/components/ServiciosPaquetes.tsx (CANTIDADES Y SUMA/RESTA)
import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, X, Check, History, ChevronsUpDown, Minus } from 'lucide-react';
import { useApp, Paquete, Service } from '@/state/AppContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
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

// ¡MODIFICADO! Tipo local con 'cantidad'
type ServiceWithQuantity = Service & { cantidad: number };

type FormDataPaquete = Omit<Paquete, 'id' | 'serviciosIncluidos' | 'precioTotal'> & {
  serviciosIncluidos: ServiceWithQuantity[]; // Usamos el tipo extendido
  precioTotal: string | number; 
};

const ServiciosPaquetes: React.FC = () => {
  const { 
    services, 
    paquetes, 
    paquetesLoading, 
    addPaquete, 
    updatePaquete, 
    deletePaquete 
  } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPaquete, setEditingPaquete] = useState<Paquete | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  
  const [openCombobox, setOpenCombobox] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  
  const [formData, setFormData] = useState<FormDataPaquete>({
    nombre: '',
    precioTotal: '',
    fechaInicio: '',
    fechaFin: '',
    serviciosIncluidos: [],
    estado: 'activo',
  });

  const filteredPaquetes = useMemo(() => {
    return paquetes.filter((paquete) =>
      paquete.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [paquetes, searchQuery]);

  const modalFilteredServices = useMemo(() => {
     if (!serviceSearch.trim()) {
         return recentServices; 
     }
     const searchLower = serviceSearch.toLowerCase();
     return services.filter(s => 
        s.nombre.toLowerCase().includes(searchLower) ||
        (s.codigo && s.codigo.toLowerCase().includes(searchLower))
     ).slice(0, 20);
  }, [services, serviceSearch, recentServices]);

  const handleOpenDialog = (paquete?: Paquete) => {
    setServiceSearch(''); 
    if (paquete) {
      // Mapear los datos guardados (que ya tienen cantidad) al formulario
      const serviciosCompletos = paquete.serviciosIncluidos
        .map(sIncluido => {
            const originalService = services.find(s => s.id === sIncluido.servicioId);
            if (!originalService) return null;
            return { 
                ...originalService, 
                cantidad: sIncluido.cantidad || 1 // Recuperar cantidad
            };
        })
        .filter(Boolean) as ServiceWithQuantity[];

      setFormData({
        nombre: paquete.nombre,
        precioTotal: paquete.precioTotal, 
        fechaInicio: paquete.fechaInicio,
        fechaFin: paquete.fechaFin,
        serviciosIncluidos: serviciosCompletos,
        estado: paquete.estado,
      });
      setEditingPaquete(paquete);
    } else {
      setFormData({
        nombre: '',
        precioTotal: '', 
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        serviciosIncluidos: [],
        estado: 'activo',
      });
      setEditingPaquete(null);
    }
    setIsDialogOpen(true);
  };
  
  // ¡MODIFICADO! Añadir o Incrementar
  const addServicio = (servicio: Service) => {
      setFormData(prev => {
          const existingIndex = prev.serviciosIncluidos.findIndex(s => s.id === servicio.id);
          
          let nuevosServicios = [...prev.serviciosIncluidos];
          
          if (existingIndex >= 0) {
              // Si ya existe, incrementamos la cantidad
              nuevosServicios[existingIndex] = {
                  ...nuevosServicios[existingIndex],
                  cantidad: nuevosServicios[existingIndex].cantidad + 1
              };
          } else {
              // Si no existe, lo añadimos con cantidad 1
              nuevosServicios.push({ ...servicio, cantidad: 1 });
          }
          
          return { ...prev, serviciosIncluidos: nuevosServicios };
      });

      setRecentServices(prev => {
          const filtered = prev.filter(s => s.id !== servicio.id);
          return [servicio, ...filtered].slice(0, 5);
      });

      setOpenCombobox(false);
      setServiceSearch('');
  };

  // ¡NUEVO! Actualizar Cantidad (+/-)
  const updateQuantity = (servicioId: string, delta: number) => {
      setFormData(prev => {
          const nuevosServicios = prev.serviciosIncluidos.map(s => {
              if (s.id === servicioId) {
                  const newQty = Math.max(1, s.cantidad + delta); // Mínimo 1
                  return { ...s, cantidad: newQty };
              }
              return s;
          });
          return { ...prev, serviciosIncluidos: nuevosServicios };
      });
  };

  // Eliminar servicio
  const removeServicio = (servicioId: string) => {
      setFormData(prev => ({
          ...prev,
          serviciosIncluidos: prev.serviciosIncluidos.filter(s => s.id !== servicioId)
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.fechaInicio || !formData.fechaFin) {
      return toast.error("Nombre y fechas son obligatorios.");
    }
    if (formData.serviciosIncluidos.length === 0) {
      return toast.error("Debe incluir al menos un servicio.");
    }

    setIsFormLoading(true);
    
    const finalPrice = formData.precioTotal === '' ? 0 : Number(formData.precioTotal);

    const paqueteParaGuardar: Omit<Paquete, 'id'> = {
      ...formData,
      precioTotal: finalPrice,
      // Guardamos la cantidad en Firestore
      serviciosIncluidos: formData.serviciosIncluidos.map(s => ({
        servicioId: s.id,
        nombre: s.nombre,
        precioOriginal: s.precio,
        cantidad: s.cantidad // Guardar cantidad
      })),
    };

    try {
      if (editingPaquete) {
        await updatePaquete(editingPaquete.id, paqueteParaGuardar);
        toast.success('Paquete actualizado');
      } else {
        await addPaquete(paqueteParaGuardar);
        toast.success('Paquete creado');
      }
      setIsDialogOpen(false);
      setEditingPaquete(null);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el paquete');
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este paquete?')) {
      try {
        await deletePaquete(id);
        toast.success('Paquete eliminado');
      } catch (error) {
        console.error(error);
        toast.error('Error al eliminar el paquete');
      }
    }
  };

  const TableLoadingSkeleton = () => (
    Array(3).fill(0).map((_, index) => (
      <TableRow key={index}>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar paquetes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Paquete
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Nombre del Paquete</TableHead>
                  <TableHead className="whitespace-nowrap">Precio</TableHead>
                  <TableHead className="whitespace-nowrap">Validez</TableHead>
                  <TableHead className="whitespace-nowrap">Servicios</TableHead>
                  <TableHead className="whitespace-nowrap">Estado</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paquetesLoading ? (
                  <TableLoadingSkeleton />
                ) : filteredPaquetes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        No se encontraron paquetes.
                      </TableCell>
                    </TableRow>
                ) : (
                  filteredPaquetes.map((paquete) => (
                    <TableRow key={paquete.id}>
                      <TableCell className="font-medium whitespace-nowrap">{paquete.nombre}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(paquete.precioTotal)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(paquete.fechaInicio)} - {formatDate(paquete.fechaFin)}</TableCell>
                      {/* Mostrar cantidad total de items (sumando cantidades) o items distintos */}
                      <TableCell className="whitespace-nowrap">
                          {paquete.serviciosIncluidos.reduce((acc, s) => acc + (s.cantidad || 1), 0)} items
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={paquete.estado === 'activo' ? 'default' : 'secondary'}>
                          {paquete.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(paquete)}
                            aria-label="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(paquete.id)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingPaquete ? 'Editar Paquete' : 'Nuevo Paquete'}</DialogTitle>
            <DialogDescription>
              {editingPaquete ? 'Modifica los datos del paquete' : 'Crea un nuevo paquete promocional'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isFormLoading} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna Izquierda: Detalles del Paquete */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paquete-nombre">Nombre del Paquete *</Label>
                  <Input
                    id="paquete-nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paquete-precio">Precio Total (MXN) *</Label>
                  <Input
                    id="paquete-precio"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.precioTotal}
                    onChange={(e) => setFormData({ ...formData, precioTotal: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paquete-inicio">Fecha Inicio *</Label>
                    <Input
                      id="paquete-inicio"
                      type="date"
                      value={formData.fechaInicio}
                      onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paquete-fin">Fecha Fin *</Label>
                    <Input
                      id="paquete-fin"
                      type="date"
                      value={formData.fechaFin}
                      onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paquete-estado">Estado</Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(v) => setFormData({ ...formData, estado: v as any })}
                  >
                    <SelectTrigger id="paquete-estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Columna Derecha: Selección de Servicios */}
              <div className="space-y-4 flex flex-col h-full">
                <Label>Servicios Incluidos ({formData.serviciosIncluidos.reduce((a, b) => a + b.cantidad, 0)}) *</Label>
                
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="w-full justify-between text-muted-foreground"
                    >
                      <span>
                        <Plus className="h-4 w-4 inline mr-2" />
                        Buscar y añadir servicio...
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
                        {modalFilteredServices.length === 0 ? (
                            <CommandEmpty>No se encontraron servicios.</CommandEmpty>
                        ) : (
                            <CommandGroup heading={serviceSearch ? "Resultados" : "Recientes"}>
                                {modalFilteredServices.map((service) => (
                                    <CommandItem
                                        key={service.id}
                                        value={service.nombre}
                                        onSelect={() => addServicio(service)}
                                    >
                                        <div className="flex justify-between w-full">
                                            <span>{service.nombre}</span>
                                            <span className="text-xs text-muted-foreground">{formatCurrency(service.precio)}</span>
                                        </div>
                                        <Plus className="ml-auto h-4 w-4 text-muted-foreground" />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Card className="flex-1 min-h-[200px] max-h-[300px] overflow-hidden flex flex-col bg-muted/20">
                    <ScrollArea className="flex-1 p-2">
                        <div className="space-y-1">
                            {formData.serviciosIncluidos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground text-sm">
                                    <p>No has añadido servicios aún.</p>
                                    <p>Usa el buscador de arriba.</p>
                                </div>
                            ) : (
                                formData.serviciosIncluidos.map(service => (
                                    <div 
                                        key={service.id} 
                                        className="flex items-center justify-between p-2 rounded-md border bg-background shadow-sm"
                                    >
                                        <div className="flex flex-col min-w-0 flex-1 mr-2">
                                            <span className="text-sm font-medium truncate">{service.nombre}</span>
                                            <span className="text-xs text-muted-foreground">{formatCurrency(service.precio)}</span>
                                        </div>

                                        {/* CONTROLES DE CANTIDAD */}
                                        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => updateQuantity(service.id, -1)}
                                                disabled={service.cantidad <= 1}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="text-xs font-mono w-6 text-center">{service.cantidad}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => updateQuantity(service.id, 1)}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-2"
                                            onClick={() => removeServicio(service.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </Card>
              </div>
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isFormLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isFormLoading}>
                {isFormLoading
                  ? 'Guardando...'
                  : editingPaquete
                  ? 'Guardar Cambios'
                  : 'Crear Paquete'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiciosPaquetes;