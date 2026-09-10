// src/components/ServiciosPaquetes.tsx (CANTIDADES Y SUMA/RESTA)
import React, { useState, useMemo } from 'react';
import { Can, useCan } from '@/auth';
import { Plus, Search, Edit, Trash2, X, Check, History, ChevronsUpDown, Minus } from 'lucide-react';
import { Paquete, usePackages } from '@/modules/packages';
import { Service, useDentalServices } from '@/modules/services';
import { formatCurrency, formatDate } from '@/shared/utils/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Switch } from '@/shared/components/ui/switch';
import { useConfirmAction } from '@/shared/hooks/useConfirmAction';
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
import { generatePackageCode } from '@/shared/utils/catalogCodes';

// ¡MODIFICADO! Tipo local con 'cantidad'
type ServiceWithQuantity = Service & { cantidad: number };

type FormDataPaquete = Omit<Paquete, 'id' | 'codigo' | 'serviciosIncluidos' | 'precioTotal'> & {
  serviciosIncluidos: ServiceWithQuantity[]; // Usamos el tipo extendido
  precioTotal: string | number; 
};

type PackageStatusFilter = 'all' | 'activo' | 'inactivo';
type PackagePriceOrder = 'default' | 'price_asc' | 'price_desc';

const ServiciosPaquetes: React.FC = () => {
  const { services } = useDentalServices();
  const { paquetes, paquetesLoading, addPaquete, updatePaquete, deletePaquete } = usePackages();
  
  const { can } = useCan();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PackageStatusFilter>('all');
  const [priceOrder, setPriceOrder] = useState<PackagePriceOrder>('default');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPaquete, setEditingPaquete] = useState<Paquete | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const { confirm, confirmationDialog } = useConfirmAction();
  const canUpdatePackages = can('packages.update');
  const canSafelyDeletePackages = can('packages.delete');
  const canSelectPackages = canUpdatePackages || canSafelyDeletePackages;
  
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
    const search = searchQuery.trim().toLowerCase();
    return paquetes
      .filter((paquete) => {
        const includedServices = paquete.serviciosIncluidos.map((service) => service.nombre).join(' ');
        const matchesSearch = !search || [paquete.nombre, paquete.codigo, includedServices]
          .some((value) => value?.toLowerCase().includes(search));
        const matchesStatus = statusFilter === 'all' || paquete.estado === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((first, second) => {
        if (priceOrder === 'price_asc') return first.precioTotal - second.precioTotal;
        if (priceOrder === 'price_desc') return second.precioTotal - first.precioTotal;
        return first.nombre.localeCompare(second.nombre, 'es', { sensitivity: 'base' });
      });
  }, [paquetes, priceOrder, searchQuery, statusFilter]);

  const generatedCode = useMemo(() => generatePackageCode(
    formData.nombre,
    formData.fechaInicio,
    formData.fechaFin,
    paquetes
      .filter((paquete) => paquete.id !== editingPaquete?.id)
      .map((paquete) => paquete.codigo ?? '')
      .filter(Boolean),
  ), [editingPaquete?.id, formData.fechaFin, formData.fechaInicio, formData.nombre, paquetes]);

  const visiblePackageIds = filteredPaquetes.map((paquete) => paquete.id);
  const selectedVisibleIds = selectedPackageIds.filter((id) => visiblePackageIds.includes(id));
  const allVisibleSelected = visiblePackageIds.length > 0 && selectedVisibleIds.length === visiblePackageIds.length;

  const togglePackageSelection = (packageId: string) => {
    setSelectedPackageIds((current) =>
      current.includes(packageId)
        ? current.filter((id) => id !== packageId)
        : [...current, packageId],
    );
  };

  const toggleAllVisible = () => {
    setSelectedPackageIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visiblePackageIds.includes(id));
      return Array.from(new Set([...current, ...visiblePackageIds]));
    });
  };

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
    if (!can(paquete ? 'packages.update' : 'packages.create')) return;
    setServiceSearch(''); 
    if (paquete) {
      // Mapear los datos guardados (que ya tienen cantidad) al formulario
      const serviciosCompletos = paquete.serviciosIncluidos
        .map(sIncluido => {
            const originalService = services.find(s => s.id === sIncluido.servicioId);
            if (!originalService) return { id: sIncluido.servicioId, nombre: sIncluido.nombre, precio: sIncluido.precioOriginal, codigo: "", descripcion: "", categoria: "", estado: "activo" as const, cantidad: sIncluido.cantidad || 1 };
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
          
          const nuevosServicios = [...prev.serviciosIncluidos];
          
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
    if (!can(editingPaquete ? 'packages.update' : 'packages.create')) return;
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
      codigo: generatedCode,
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
    if (!canSafelyDeletePackages) return;
    const confirmed = await confirm({
      title: 'Eliminar paquete',
      description: 'El paquete quedará inactivo para conservar cotizaciones y ventas existentes.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deletePaquete(id);
      toast.success('Paquete desactivado');
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar el paquete');
    }
  };

  const handleStatusChange = async (id: string, active: boolean) => {
    if (!canUpdatePackages) return;
    try {
      await updatePaquete(id, { estado: active ? 'activo' : 'inactivo' });
      toast.success(active ? 'Paquete activado' : 'Paquete desactivado');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cambiar el estado del paquete');
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    const targetIds = selectedVisibleIds;
    if (targetIds.length === 0) return;
    if (action === 'delete' ? !canSafelyDeletePackages : !canUpdatePackages) return;

    const labels = {
      activate: { title: 'Activar paquetes', description: `Se activarán ${targetIds.length} paquete(s).`, confirmLabel: 'Activar' },
      deactivate: { title: 'Desactivar paquetes', description: `Se desactivarán ${targetIds.length} paquete(s).`, confirmLabel: 'Desactivar' },
      delete: { title: 'Eliminar paquetes', description: `Se marcarán como inactivos ${targetIds.length} paquete(s) para conservar su historial.`, confirmLabel: 'Eliminar' },
    }[action];

    const confirmed = await confirm({ ...labels, destructive: action !== 'activate' });
    if (!confirmed) return;

    setIsBulkLoading(true);
    try {
      await Promise.all(targetIds.map((id) => action === 'delete'
        ? deletePaquete(id)
        : updatePaquete(id, { estado: action === 'activate' ? 'activo' : 'inactivo' })));
      setSelectedPackageIds((current) => current.filter((id) => !targetIds.includes(id)));
      toast.success(`${targetIds.length} paquete(s) actualizado(s)`);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo completar la acción por lote');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const TableLoadingSkeleton = () => (
    Array(3).fill(0).map((_, index) => (
      <TableRow key={index}>
        {canSelectPackages && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
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
    <div className="flex h-[max(22rem,calc(100dvh-16rem))] min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="grid w-full gap-2 sm:grid-cols-[minmax(14rem,1fr)_10rem_11rem] lg:max-w-3xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Buscar paquetes"
              placeholder="Nombre, código o servicio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PackageStatusFilter)}>
            <SelectTrigger className="h-9" aria-label="Filtrar paquetes por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="inactivo">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priceOrder} onValueChange={(value) => setPriceOrder(value as PackagePriceOrder)}>
            <SelectTrigger className="h-9" aria-label="Ordenar paquetes por precio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Nombre: A-Z</SelectItem>
              <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
              <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Can permission="packages.create"><Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Paquete
        </Button></Can>
      </div>

      {canSelectPackages && filteredPaquetes.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Checkbox
              checked={allVisibleSelected ? true : selectedVisibleIds.length > 0 ? 'indeterminate' : false}
              onCheckedChange={toggleAllVisible}
              aria-label="Seleccionar paquetes visibles"
            />
            <span>{selectedVisibleIds.length} seleccionado(s)</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={toggleAllVisible} disabled={isBulkLoading}>
            {allVisibleSelected ? 'Quitar visibles' : 'Seleccionar visibles'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPackageIds([])} disabled={selectedPackageIds.length === 0 || isBulkLoading}>
            <X className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
          {canUpdatePackages && <Button type="button" variant="outline" size="sm" onClick={() => void handleBulkAction('activate')} disabled={selectedVisibleIds.length === 0 || isBulkLoading}>Activar</Button>}
          {canUpdatePackages && <Button type="button" variant="outline" size="sm" onClick={() => void handleBulkAction('deactivate')} disabled={selectedVisibleIds.length === 0 || isBulkLoading}>Desactivar</Button>}
          {canSafelyDeletePackages && <Button type="button" variant="destructive" size="sm" onClick={() => void handleBulkAction('delete')} disabled={selectedVisibleIds.length === 0 || isBulkLoading}>Eliminar</Button>}
        </div>
      )}

      <Card className="relative isolate z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="min-h-0 flex-1 p-0">
          <div className="relative isolate z-0 h-full min-h-0 overflow-y-auto overscroll-contain [&>div]:overflow-visible">
            <Table>
              <TableHeader className="sticky top-0 z-[1] bg-card shadow-sm">
                <TableRow>
                  {canSelectPackages && <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : selectedVisibleIds.length > 0 ? 'indeterminate' : false}
                      onCheckedChange={toggleAllVisible}
                      aria-label="Seleccionar todos los paquetes visibles"
                    />
                  </TableHead>}
                  <TableHead className="whitespace-nowrap">Código</TableHead>
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
                      <TableCell colSpan={canSelectPackages ? 8 : 7} className="text-center h-24">
                        No se encontraron paquetes.
                      </TableCell>
                    </TableRow>
                ) : (
                  filteredPaquetes.map((paquete) => (
                    <TableRow key={paquete.id}>
                      {canSelectPackages && <TableCell>
                        <Checkbox
                          checked={selectedPackageIds.includes(paquete.id)}
                          onCheckedChange={() => togglePackageSelection(paquete.id)}
                          aria-label={`Seleccionar ${paquete.nombre}`}
                        />
                      </TableCell>}
                      <TableCell className="font-mono text-sm whitespace-nowrap">{paquete.codigo || 'Sin código'}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{paquete.nombre}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(paquete.precioTotal)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(paquete.fechaInicio)} - {formatDate(paquete.fechaFin)}</TableCell>
                      {/* Mostrar cantidad total de items (sumando cantidades) o items distintos */}
                      <TableCell className="whitespace-nowrap">
                          {paquete.serviciosIncluidos.reduce((acc, s) => acc + (s.cantidad || 1), 0)} items
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {canUpdatePackages ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={paquete.estado === 'activo'}
                              onCheckedChange={(checked) => void handleStatusChange(paquete.id, checked)}
                              disabled={isFormLoading || isBulkLoading}
                              aria-label={`${paquete.estado === 'activo' ? 'Desactivar' : 'Activar'} ${paquete.nombre}`}
                            />
                            <span className="text-sm capitalize">{paquete.estado}</span>
                          </div>
                        ) : (
                          <Badge variant={paquete.estado === 'activo' ? 'default' : 'secondary'}>
                            {paquete.estado}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Can permission="packages.update"><Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(paquete)}
                            aria-label="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button></Can>
                          {canSafelyDeletePackages && <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(paquete.id)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>}
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

      <Dialog open={isDialogOpen && can(editingPaquete ? 'packages.update' : 'packages.create')} onOpenChange={setIsDialogOpen}>
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
      {confirmationDialog}
    </div>
  );
};

export default ServiciosPaquetes;
