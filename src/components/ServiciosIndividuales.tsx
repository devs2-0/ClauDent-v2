// (Archivo MODIFICADO) src/components/ServiciosIndividuales.tsx
import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { formatCurrency } from '@/lib/utils';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const ServiciosIndividuales: React.FC = () => {
  const { services, addService, updateService, deleteService, servicesLoading } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  
  const [formData, setFormData] = useState<{
    codigo: string;
    nombre: string;
    descripcion: string;
    precio: string | number;
    categoria: string;
    estado: 'activo' | 'inactivo';
  }>({
    codigo: '',
    nombre: '',
    descripcion: '',
    precio: '',
    categoria: '',
    estado: 'activo',
  });

  const filteredServices = useMemo(() => {
    return services.filter((service) =>
      service.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.codigo && service.codigo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (service.categoria && service.categoria.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [services, searchQuery]);

  const handleOpenDialog = (serviceId?: string) => {
    if (serviceId) {
      const service = services.find((s) => s.id === serviceId);
      if (service) {
        setFormData({
          codigo: service.codigo,
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
        codigo: '',
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
    setIsFormLoading(true);
    
    const finalPrice = formData.precio === '' ? 0 : Number(formData.precio);

    const payload = {
        ...formData,
        precio: finalPrice
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
    if (confirm('¿Está seguro de eliminar este servicio?')) {
      try {
        await deleteService(id);
        toast.success('Servicio eliminado');
      } catch (error) {
        console.error(error);
        toast.error('Error al eliminar el servicio');
      }
    }
  };

  const TableLoadingSkeleton = () => (
    Array(5).fill(0).map((_, index) => (
      <TableRow key={index}>
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
    <div className="space-y-6 h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar servicios individuales..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Servicio
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 overflow-hidden">
          {/* ¡ALTURA DINÁMICA! */}
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
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
                      <TableCell colSpan={6} className="text-center h-24">
                        No se encontraron servicios.
                      </TableCell>
                    </TableRow>
                ) : (
                  filteredServices.map((service) => (
                    <TableRow key={service.id}>
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
                        <Badge variant={service.estado === 'activo' ? 'default' : 'secondary'}>
                          {service.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(service.id)}
                            aria-label="Editar"
                            disabled={isFormLoading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(service.id)}
                            aria-label="Eliminar"
                            disabled={isFormLoading}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
            <DialogDescription>
              {editingService ? 'Modifica los datos del servicio' : 'Ingresa los datos del nuevo servicio'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isFormLoading} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría *</Label>
                  <Input
                    id="categoria"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    required
                  />
                </div>
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
                    step="0.01" 
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
    </div>
  );
};

export default ServiciosIndividuales;