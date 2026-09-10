// (Archivo MODIFICADO) src/components/ServiciosIndividuales.tsx
import React, { useState, useMemo } from 'react';
import { Can, useCan } from '@/auth';
import { Edit, Plus, Search, Trash2, X } from 'lucide-react';
import { useDentalServices } from '@/modules/services';
import { formatCurrency } from '@/shared/utils/utils';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Switch } from '@/shared/components/ui/switch';
import { useConfirmAction } from '@/shared/hooks/useConfirmAction';
import { generateServiceCode } from '@/shared/utils/catalogCodes';

type ServiceStatusFilter = 'all' | 'activo' | 'inactivo';
type ServicePriceOrder = 'default' | 'price_asc' | 'price_desc';

const ServiciosIndividuales: React.FC = () => {
  const { services, addService, updateService, deleteService, servicesLoading } = useDentalServices();
  
  const { can } = useCan();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>('all');
  const [priceOrder, setPriceOrder] = useState<ServicePriceOrder>('default');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const { confirm, confirmationDialog } = useConfirmAction();
  const canUpdateServices = can('services.update');
  const canSafelyDeleteServices = can('services.delete');
  const canSelectServices = canUpdateServices || canSafelyDeleteServices;
  
  const [formData, setFormData] = useState<{
    nombre: string;
    descripcion: string;
    precio: string | number;
    categoria: string;
    estado: 'activo' | 'inactivo';
  }>({
    nombre: '',
    descripcion: '',
    precio: '',
    categoria: '',
    estado: 'activo',
  });

  const filteredServices = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return services
      .filter((service) => {
        const matchesSearch = !search || [service.nombre, service.codigo, service.categoria]
          .some((value) => value?.toLowerCase().includes(search));
        const matchesStatus = statusFilter === 'all' || service.estado === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((first, second) => {
        if (priceOrder === 'price_asc') return first.precio - second.precio;
        if (priceOrder === 'price_desc') return second.precio - first.precio;
        return first.nombre.localeCompare(second.nombre, 'es', { sensitivity: 'base' });
      });
  }, [services, searchQuery, statusFilter, priceOrder]);

  const generatedCode = useMemo(() => generateServiceCode(
    formData.categoria,
    formData.nombre,
    Number(formData.precio),
    services
      .filter((service) => service.id !== editingService)
      .map((service) => service.codigo)
      .filter(Boolean),
  ), [editingService, formData.categoria, formData.nombre, formData.precio, services]);

  const visibleServiceIds = filteredServices.map((service) => service.id);
  const selectedVisibleIds = selectedServiceIds.filter((id) => visibleServiceIds.includes(id));
  const allVisibleSelected = visibleServiceIds.length > 0 && selectedVisibleIds.length === visibleServiceIds.length;

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  };

  const toggleAllVisible = () => {
    setSelectedServiceIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleServiceIds.includes(id));
      return Array.from(new Set([...current, ...visibleServiceIds]));
    });
  };

  const handleOpenDialog = (serviceId?: string) => {
    if (!can(serviceId ? 'services.update' : 'services.create')) return;
    if (serviceId) {
      const service = services.find((s) => s.id === serviceId);
      if (service) {
        setFormData({
          nombre: service.nombre,
          descripcion: service.descripcion,
          precio: service.precio,
          categoria: service.categoria,
          estado: service.estado,
        });
        setEditingService(service.id);
      }
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        precio: '',
        categoria: '',
        estado: 'activo',
      });
      setEditingService(null);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can(editingService ? 'services.update' : 'services.create')) return;
    const finalPrice = formData.precio === '' ? 0 : Number(formData.precio);
    if (!formData.categoria.trim() || !formData.nombre.trim() || !Number.isFinite(finalPrice)) {
      toast.error('Completa categoría, nombre y precio.');
      return;
    }
    if (!generatedCode) {
      toast.error('No se pudo generar el código del servicio.');
      return;
    }
    setIsFormLoading(true);

    const payload = {
        ...formData,
        codigo: generatedCode,
        precio: finalPrice,
    };

    try {
      if (editingService) {
        await updateService(editingService, payload);
        toast.success('Servicio actualizado');
      } else {
        await addService(payload);
        toast.success('Servicio creado');
      }
      setIsDialogOpen(false);
      setEditingService(null);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el servicio');
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canSafelyDeleteServices) return;
    const confirmed = await confirm({
      title: 'Eliminar servicio',
      description: 'El servicio quedará inactivo para conservar cotizaciones e historiales existentes.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteService(id);
      toast.success('Servicio desactivado');
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar el servicio');
    }
  };

  const handleStatusChange = async (id: string, active: boolean) => {
    if (!canUpdateServices) return;
    try {
      await updateService(id, { estado: active ? 'activo' : 'inactivo' });
      toast.success(active ? 'Servicio activado' : 'Servicio desactivado');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cambiar el estado del servicio');
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    const targetIds = selectedVisibleIds;
    if (targetIds.length === 0) return;
    if (action === 'delete' ? !canSafelyDeleteServices : !canUpdateServices) return;

    const labels = {
      activate: { title: 'Activar servicios', description: `Se activarán ${targetIds.length} servicio(s).`, confirmLabel: 'Activar' },
      deactivate: { title: 'Desactivar servicios', description: `Se desactivarán ${targetIds.length} servicio(s).`, confirmLabel: 'Desactivar' },
      delete: { title: 'Eliminar servicios', description: `Se marcarán como inactivos ${targetIds.length} servicio(s) para conservar su historial.`, confirmLabel: 'Eliminar' },
    }[action];

    const confirmed = await confirm({ ...labels, destructive: action !== 'activate' });
    if (!confirmed) return;

    setIsBulkLoading(true);
    try {
      await Promise.all(targetIds.map((id) => action === 'delete'
        ? deleteService(id)
        : updateService(id, { estado: action === 'activate' ? 'activo' : 'inactivo' })));
      setSelectedServiceIds((current) => current.filter((id) => !targetIds.includes(id)));
      toast.success(`${targetIds.length} servicio(s) actualizado(s)`);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo completar la acción por lote');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const TableLoadingSkeleton = () => (
    Array(5).fill(0).map((_, index) => (
      <TableRow key={index}>
        {canSelectServices && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48 mt-1" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
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
              aria-label="Buscar servicios"
              placeholder="Nombre, categoría o código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ServiceStatusFilter)}>
            <SelectTrigger className="h-9" aria-label="Filtrar servicios por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="inactivo">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priceOrder} onValueChange={(value) => setPriceOrder(value as ServicePriceOrder)}>
            <SelectTrigger className="h-9" aria-label="Ordenar servicios por precio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Nombre: A-Z</SelectItem>
              <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
              <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Can permission="services.create"><Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Servicio
        </Button></Can>
      </div>

      {canSelectServices && filteredServices.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Checkbox
              checked={allVisibleSelected ? true : selectedVisibleIds.length > 0 ? 'indeterminate' : false}
              onCheckedChange={toggleAllVisible}
              aria-label="Seleccionar servicios visibles"
            />
            <span>{selectedVisibleIds.length} seleccionado(s)</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={toggleAllVisible} disabled={isBulkLoading}>
            {allVisibleSelected ? 'Quitar visibles' : 'Seleccionar visibles'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedServiceIds([])} disabled={selectedServiceIds.length === 0 || isBulkLoading}>
            <X className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
          {canUpdateServices && <Button type="button" variant="outline" size="sm" onClick={() => void handleBulkAction('activate')} disabled={selectedVisibleIds.length === 0 || isBulkLoading}>Activar</Button>}
          {canUpdateServices && <Button type="button" variant="outline" size="sm" onClick={() => void handleBulkAction('deactivate')} disabled={selectedVisibleIds.length === 0 || isBulkLoading}>Desactivar</Button>}
          {canSafelyDeleteServices && <Button type="button" variant="destructive" size="sm" onClick={() => void handleBulkAction('delete')} disabled={selectedVisibleIds.length === 0 || isBulkLoading}>Eliminar</Button>}
        </div>
      )}

      <Card className="relative isolate z-0 min-h-0 flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 min-h-0 flex-1 overflow-hidden">
          <div className="relative isolate z-0 h-full min-h-0 overflow-y-auto overscroll-contain [&>div]:overflow-visible">
            <Table>
              <TableHeader className="sticky top-0 z-[1] bg-card shadow-sm">
                <TableRow>
                  {canSelectServices && <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : selectedVisibleIds.length > 0 ? 'indeterminate' : false}
                      onCheckedChange={toggleAllVisible}
                      aria-label="Seleccionar todos los servicios visibles"
                    />
                  </TableHead>}
                  <TableHead className="whitespace-nowrap">Código</TableHead>
                  <TableHead className="whitespace-nowrap">Servicio</TableHead>
                  <TableHead className="whitespace-nowrap">Categoría</TableHead>
                  <TableHead className="whitespace-nowrap">Precio</TableHead>
                  <TableHead className="whitespace-nowrap">Estado</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicesLoading ? (
                  <TableLoadingSkeleton />
                ) : filteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canSelectServices ? 7 : 6} className="text-center h-24">
                        No se encontraron servicios.
                      </TableCell>
                    </TableRow>
                ) : (
                  filteredServices.map((service) => (
                    <TableRow key={service.id}>
                      {canSelectServices && <TableCell>
                        <Checkbox
                          checked={selectedServiceIds.includes(service.id)}
                          onCheckedChange={() => toggleServiceSelection(service.id)}
                          aria-label={`Seleccionar ${service.nombre}`}
                        />
                      </TableCell>}
                      <TableCell className="font-mono text-sm whitespace-nowrap">{service.codigo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium whitespace-nowrap">{service.nombre}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{service.descripcion}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{service.categoria}</TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(service.precio)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {canUpdateServices ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={service.estado === 'activo'}
                              onCheckedChange={(checked) => void handleStatusChange(service.id, checked)}
                              disabled={isFormLoading || isBulkLoading}
                              aria-label={`${service.estado === 'activo' ? 'Desactivar' : 'Activar'} ${service.nombre}`}
                            />
                            <span className="text-sm capitalize">{service.estado}</span>
                          </div>
                        ) : (
                          <Badge variant={service.estado === 'activo' ? 'default' : 'secondary'}>
                            {service.estado}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Can permission="services.update"><Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(service.id)}
                            aria-label="Editar"
                            disabled={isFormLoading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button></Can>
                          {canSafelyDeleteServices && <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(service.id)}
                            aria-label="Eliminar"
                            disabled={isFormLoading}
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

      <Dialog open={isDialogOpen && can(editingService ? 'services.update' : 'services.create')} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
            <DialogDescription>
              {editingService ? 'Modifica los datos del servicio' : 'Ingresa los datos del nuevo servicio'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isFormLoading} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría *</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Servicio *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio (MXN) *</Label>
                  <Input
                    id="precio"
                    type="number"
                    min="0"
                    step="0.1" 
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(v) => setFormData({ ...formData, estado: v as any })}
                  >
                    <SelectTrigger id="estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  : editingService
                  ? 'Guardar Cambios'
                  : 'Crear Servicio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {confirmationDialog}
    </div>
  );
};

export default ServiciosIndividuales;
