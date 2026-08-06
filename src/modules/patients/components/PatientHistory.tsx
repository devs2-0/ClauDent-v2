// RF03: Patient clinical history (BUSCADOR + EDITABLE + FIX FECHA)
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, PackageMinus, Plus, Check, ChevronsUpDown, X, Edit, Trash2 } from 'lucide-react';
import { usePermissions } from '@/auth';
import { usePatients, HistoryEntry } from '@/modules/patients';
import { useInventory } from '@/modules/inventario';
import { Service, useDentalServices } from '@/modules/services';
import { formatCurrency, formatDate } from '@/shared/utils/utils';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { toast } from 'sonner';
// Importaciones de Firebase
import { collection, query, onSnapshot, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/shared/components/ui/skeleton';
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

interface PatientHistoryProps {
  patientId: string;
}

const PatientHistory: React.FC<PatientHistoryProps> = ({ patientId }) => {
  const { services } = useDentalServices();
  const { addHistoryEntry, updateHistoryEntry, deleteHistoryEntry } = usePatients();
  const { products, registerMovement } = useInventory();
  const { hasPermission } = usePermissions();
  const canRegisterClinicalMaterials = hasPermission('inventory.usage.create');
  
  const [historial, setHistorial] = useState<HistoryEntry[]>([]);
  const [historialLoading, setHistorialLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  
  // Estado para edición
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    servicios: [] as { servicioId: string; cantidad: number }[],
    materialesClinicos: [] as {
      productoId: string;
      cantidad: number;
      autorizadoPorNombre: string;
      segundaAutorizacionNombre: string;
    }[],
    notas: '',
  });

  // --- Lógica de Buscador de Servicios ---
  const [openComboboxIndex, setOpenComboboxIndex] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const [openMaterialComboboxIndex, setOpenMaterialComboboxIndex] = useState<number | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');

  const filteredServiceOptions = useMemo(() => {
    if (!serviceSearch.trim()) return recentServices;
    const searchLower = serviceSearch.toLowerCase();
    return services.filter(s => 
        s.nombre.toLowerCase().includes(searchLower) || 
        (s.codigo && s.codigo.toLowerCase().includes(searchLower))
    ).slice(0, 20);
  }, [services, serviceSearch, recentServices]);

  const clinicalMaterialOptions = useMemo(() => {
    const activeProducts = products.filter((product) => product.estado === 'activo');
    const clinicalProducts = activeProducts.filter((product) => product.categoria !== 'vendible');
    return clinicalProducts.length ? clinicalProducts : activeProducts;
  }, [products]);

  const filteredMaterialOptions = useMemo(() => {
    const searchLower = materialSearch.trim().toLowerCase();
    const options = clinicalMaterialOptions.filter((product) => {
      if (!searchLower) return true;
      return [
        product.nombre,
        product.marca,
        product.categoria,
        product.proveedor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchLower);
    });

    return options.slice(0, 25);
  }, [clinicalMaterialOptions, materialSearch]);

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

  const getProductLabel = (product: { nombre: string; marca?: string }) => {
    return product.marca ? `${product.nombre} (${product.marca})` : product.nombre;
  };

  const handleSelectMaterial = (index: number, productId: string) => {
    const newMateriales = [...formData.materialesClinicos];
    newMateriales[index] = { ...newMateriales[index], productoId };
    setFormData({ ...formData, materialesClinicos: newMateriales });
    setOpenMaterialComboboxIndex(null);
    setMaterialSearch('');
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
            materialesClinicos: [],
            notas: entry.notas || '',
        });
    } else {
        setEditingEntryId(null);
        setFormData({
            fecha: new Date().toISOString().split('T')[0],
            servicios: [],
            materialesClinicos: [],
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

  const handleAddMaterialRow = () => {
    setFormData({
      ...formData,
      materialesClinicos: [
        ...formData.materialesClinicos,
        {
          productoId: '',
          cantidad: 1,
          autorizadoPorNombre: '',
          segundaAutorizacionNombre: '',
        },
      ],
    });
  };

  const handleRemoveMaterialRow = (index: number) => {
    setFormData({
      ...formData,
      materialesClinicos: formData.materialesClinicos.filter((_, i) => i !== index),
    });
  };

  const handleMaterialQuantityChange = (index: number, value: string) => {
    const newMateriales = [...formData.materialesClinicos];
    newMateriales[index] = { ...newMateriales[index], cantidad: parseFloat(value) || 0 };
    setFormData({ ...formData, materialesClinicos: newMateriales });
  };

  const handleMaterialAuthorizationChange = (
    index: number,
    field: 'autorizadoPorNombre' | 'segundaAutorizacionNombre',
    value: string,
  ) => {
    const newMateriales = [...formData.materialesClinicos];
    newMateriales[index] = { ...newMateriales[index], [field]: value };
    setFormData({ ...formData, materialesClinicos: newMateriales });
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

    if (!editingEntryId && formData.materialesClinicos.length > 0) {
      if (!canRegisterClinicalMaterials) {
        toast.error('Tu rol necesita el permiso inventory.usage.create para registrar salidas clinicas de inventario');
        return;
      }

      const usedProductIds = new Set<string>();
      const belowMinimumWarnings: string[] = [];

      for (const material of formData.materialesClinicos) {
        const product = clinicalMaterialOptions.find((item) => item.id === material.productoId);
        const quantity = Number(material.cantidad) || 0;

        if (!product) {
          toast.error('Selecciona un material de inventario para todas las filas');
          return;
        }

        if (usedProductIds.has(product.id)) {
          toast.error(`El material ${getProductLabel(product)} ya fue agregado. Ajusta su cantidad en una sola fila.`);
          return;
        }
        usedProductIds.add(product.id);

        if (quantity <= 0) {
          toast.error('La cantidad de material debe ser mayor a cero');
          return;
        }

        if (quantity > product.stock) {
          toast.error(`Stock insuficiente para ${getProductLabel(product)}. Disponible: ${product.stock} ${product.unidad}`);
          return;
        }

        const classification = product.clasificacion ?? 'normal';
        if (classification !== 'normal' && !material.autorizadoPorNombre.trim()) {
          toast.error(`Registra quien autorizo el retiro de ${getProductLabel(product)}`);
          return;
        }

        if ((classification === 'alto_costo' || classification === 'equipo_especial') && !material.segundaAutorizacionNombre.trim()) {
          toast.error(`${getProductLabel(product)} requiere doble autorizacion`);
          return;
        }

        const nextStock = product.stock - quantity;
        if (nextStock < product.stockMinimo) {
          belowMinimumWarnings.push(`${getProductLabel(product)} quedara en ${nextStock} ${product.unidad}; minimo ${product.stockMinimo}.`);
        }
      }

      if (belowMinimumWarnings.length > 0) {
        const shouldContinue = window.confirm(
          `Esta salida dejara material por debajo del stock minimo:\n\n${belowMinimumWarnings.join('\n')}\n\nDeseas registrar la salida clinica de todos modos?`,
        );
        if (!shouldContinue) return;
      }
    }

    setIsFormLoading(true);
    const payload = {
        fecha: formData.fecha,
        servicios: formData.servicios,
        notas: formData.notas,
        total: calculateTotal(),
        ...(!editingEntryId ? { materialesClinicos: [] } : {}),
    };

    try {
      if (editingEntryId) {
        await updateHistoryEntry(patientId, editingEntryId, payload);
        toast.success('Entrada actualizada');
      } else {
        const historyEntryId = await addHistoryEntry(patientId, payload);
        const materialesRegistrados = [];

        for (const material of formData.materialesClinicos) {
          const product = clinicalMaterialOptions.find((item) => item.id === material.productoId);
          if (!product) continue;

          const quantity = Number(material.cantidad) || 0;
          const movimientoId = await registerMovement({
            productoId: product.id,
            fecha: formData.fecha,
            tipo: 'uso_clinico',
            cantidad: quantity,
            motivo: `Salida clinica por procedimiento ${historyEntryId}`,
            referenciaTipo: 'tratamiento',
            referenciaId: historyEntryId,
            autorizadoPorNombre: material.autorizadoPorNombre.trim(),
            segundaAutorizacionNombre: material.segundaAutorizacionNombre.trim(),
          });

          materialesRegistrados.push({
            productoId: product.id,
            productoNombre: getProductLabel(product),
            cantidad: quantity,
            unidad: product.unidad,
            stockAnterior: product.stock,
            stockNuevo: product.stock - quantity,
            movimientoId,
          });
        }

        if (materialesRegistrados.length > 0) {
          await updateHistoryEntry(patientId, historyEntryId, { materialesClinicos: materialesRegistrados });
        }
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
                {entry.materialesClinicos && entry.materialesClinicos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Materiales consumidos:</p>
                    <ul className="space-y-1">
                      {entry.materialesClinicos.map((material, idx) => (
                        <li key={`${material.productoId}-${idx}`} className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <PackageMinus className="h-3.5 w-3.5" />
                          <span>{material.productoNombre}</span>
                          <Badge variant="outline">
                            {material.cantidad} {material.unidad || 'unidad'}
                          </Badge>
                          {material.stockNuevo !== undefined && (
                            <span className="text-xs">Stock: {material.stockAnterior} a {material.stockNuevo}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                            min="1" 
                            step="1" 
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

                <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Label>Materiales clinicos consumidos</Label>
                            <p className="text-xs text-muted-foreground">
                                Al guardar una entrada nueva se descuenta stock y se genera movimiento de salida clinica.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddMaterialRow}
                            disabled={Boolean(editingEntryId) || !canRegisterClinicalMaterials}
                        >
                            <PackageMinus className="h-4 w-4 mr-1" />
                            Agregar material
                        </Button>
                    </div>
                    {editingEntryId && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            Los materiales solo se registran al crear la entrada para evitar duplicar salidas de inventario.
                        </div>
                    )}
                    {!editingEntryId && !canRegisterClinicalMaterials && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            Tu rol puede guardar historial clinico, pero necesita inventory.usage.create para descontar materiales de inventario.
                        </div>
                    )}
                    {formData.materialesClinicos.map((material, index) => {
                        const selectedProduct = clinicalMaterialOptions.find((product) => product.id === material.productoId);
                        const classification = selectedProduct?.clasificacion ?? 'normal';
                        const needsAuthorization = classification !== 'normal';
                        const needsSecondAuthorization = classification === 'alto_costo' || classification === 'equipo_especial';
                        const nextStock = selectedProduct ? selectedProduct.stock - (Number(material.cantidad) || 0) : null;
                        const belowMinimum = selectedProduct && nextStock !== null && nextStock < selectedProduct.stockMinimo;

                        return (
                            <div key={index} className="space-y-3 rounded-md border p-3">
                                <div className="grid gap-2 lg:grid-cols-[1fr_96px_auto] lg:items-center">
                                    <Popover
                                        open={openMaterialComboboxIndex === index}
                                        onOpenChange={(isOpen) => {
                                            setOpenMaterialComboboxIndex(isOpen ? index : null);
                                            if (!isOpen) setMaterialSearch('');
                                        }}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "justify-between overflow-hidden font-normal",
                                                    !material.productoId && "text-muted-foreground"
                                                )}
                                            >
                                                <span className="truncate">
                                                    {selectedProduct
                                                        ? `${getProductLabel(selectedProduct)} / stock ${selectedProduct.stock} ${selectedProduct.unidad}`
                                                        : "Buscar material..."}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[360px] p-0" align="start">
                                            <Command shouldFilter={false}>
                                                <CommandInput
                                                    placeholder="Buscar producto, marca o categoria..."
                                                    value={materialSearch}
                                                    onValueChange={setMaterialSearch}
                                                />
                                                <CommandList>
                                                    {filteredMaterialOptions.length === 0 ? (
                                                        <CommandEmpty>No encontrado.</CommandEmpty>
                                                    ) : (
                                                        <CommandGroup heading="Inventario clinico">
                                                            {filteredMaterialOptions.map((product) => (
                                                                <CommandItem
                                                                    key={product.id}
                                                                    value={getProductLabel(product)}
                                                                    onSelect={() => handleSelectMaterial(index, product.id)}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            material.productoId === product.id ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate font-medium">{getProductLabel(product)}</p>
                                                                        <p className="truncate text-xs text-muted-foreground">
                                                                            Stock {product.stock} {product.unidad} / minimo {product.stockMinimo}
                                                                        </p>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    )}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={material.cantidad}
                                        onChange={(event) => handleMaterialQuantityChange(index, event.target.value)}
                                        placeholder="Cant."
                                    />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => handleRemoveMaterialRow(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {selectedProduct && (
                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <Badge variant={selectedProduct.stock <= 0 ? "destructive" : "secondary"}>
                                            Disponible: {selectedProduct.stock} {selectedProduct.unidad}
                                        </Badge>
                                        {belowMinimum && (
                                            <span className="inline-flex items-center gap-1 text-amber-700">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Quedara por debajo del minimo.
                                            </span>
                                        )}
                                    </div>
                                )}

                                {needsAuthorization && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label>Autorizo retiro *</Label>
                                            <Input
                                                value={material.autorizadoPorNombre}
                                                onChange={(event) => handleMaterialAuthorizationChange(index, 'autorizadoPorNombre', event.target.value)}
                                                placeholder="Nombre del responsable"
                                            />
                                        </div>
                                        {needsSecondAuthorization && (
                                            <div className="space-y-1">
                                                <Label>Segunda autorizacion *</Label>
                                                <Input
                                                    value={material.segundaAutorizacionNombre}
                                                    onChange={(event) => handleMaterialAuthorizationChange(index, 'segundaAutorizacionNombre', event.target.value)}
                                                    placeholder="Nombre de quien confirma"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {!editingEntryId && formData.materialesClinicos.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center">No hay materiales consumidos registrados.</p>
                    )}
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
