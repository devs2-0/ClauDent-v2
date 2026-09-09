// RF02-RF05: Patients list (CORREGIDO: BUG DE ALERTDIALOG)
import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Edit, Eye, Filter, User, Phone, ChevronLeft, ChevronRight, ClipboardCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import { useCan } from '@/auth';
import { Patient, usePatients } from '@/modules/patients';
import { usePatientClinicalHistoryStatuses } from '@/modules/patients/hooks/usePatientClinicalHistoryStatuses';
import {
  calculatePatientAge,
  hasKnownMaritalStatus,
  MARITAL_STATUS_OPTIONS,
  normalizePatientName,
  type ClinicalHistoryStatus,
} from '@/modules/patients/utils/patientUi';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { SectionHelp } from '@/shared/components/SectionHelp';
import { useConfirmAction } from '@/shared/hooks/useConfirmAction';
import InitialHistoryModal from '@/modules/patients/components/InitialHistoryModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

const initialFormData: Omit<Patient, 'id' | 'fechaRegistro'> = {
  nombres: '', apellidos: '', fechaNacimiento: '', sexo: 'X', telefonoPrincipal: '', telefonoContacto: '', correo: '', curp: '', direccion: '', calle: '', numeroExterior: '', numeroInterior: '', colonia: '', municipio: '', estadoDireccion: '', estadoCivil: '', estado: 'activo',
};

const ITEMS_PER_PAGE = 12;
type PatientSortOrder = 'recent' | 'oldest' | 'alphabetical';

const toDateKey = (value?: string) => {
  if (!value) return '';
  const isoDate = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1];
  if (isoDate) return isoDate;

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? ''
    : parsedDate.toISOString().slice(0, 10);
};

const Pacientes: React.FC = () => {
  const { patients, addPatient, updatePatient, searchQuery, patientsLoading } = usePatients();
  const { can, loading: permissionsLoading } = useCan();
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm, confirmationDialog } = useConfirmAction();
  const canCreatePatient = can('patients.create');
  const canUpdatePatient = can('patients.update');
  const canDeletePatient = can('patients.delete');
  const canManagePatientSelection = canUpdatePatient || canDeletePatient;

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [filterStatus, setFilterStatus] = useState<'all' | 'activo' | 'inactivo'>('activo');
  const [sortOrder, setSortOrder] = useState<PatientSortOrder>('recent');
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<string | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [crearHistorial, setCrearHistorial] = useState(false);
  
  const [historyModalState, setHistoryModalState] = useState<{isOpen: boolean; patientId: string | null}>({ isOpen: false, patientId: null });
  const [formData, setFormData] = useState<Omit<Patient, 'id' | 'fechaRegistro'>>(initialFormData);

  const filteredPatients = useMemo(() => {
    const matchingPatients = patients.filter((patient) => {
      const searchLower = localSearch.trim().toLowerCase();
      const matchesSearch =
        patient.nombres.toLowerCase().includes(searchLower) ||
        patient.apellidos.toLowerCase().includes(searchLower) ||
        (patient.curp && patient.curp.toLowerCase().includes(searchLower)) ||
        (patient.correo && patient.correo.toLowerCase().includes(searchLower)) ||
        (patient.telefonoPrincipal && patient.telefonoPrincipal.includes(searchLower)) ||
        (patient.telefonoContacto && patient.telefonoContacto.includes(searchLower));

      const matchesStatus = filterStatus === 'all' || patient.estado === filterStatus;

      return matchesSearch && matchesStatus;
    });

    if (sortOrder === 'alphabetical') {
      return [...matchingPatients].sort((first, second) => {
        const nameComparison = first.nombres.localeCompare(second.nombres, 'es-MX', {
          sensitivity: 'base',
        });
        if (nameComparison !== 0) return nameComparison;

        return first.apellidos.localeCompare(second.apellidos, 'es-MX', {
          sensitivity: 'base',
        });
      });
    }

    return [...matchingPatients].sort((first, second) => {
      const firstDate = toDateKey(first.fechaRegistro);
      const secondDate = toDateKey(second.fechaRegistro);
      if (!firstDate && !secondDate) return 0;
      if (!firstDate) return 1;
      if (!secondDate) return -1;

      return sortOrder === 'oldest'
        ? firstDate.localeCompare(secondDate)
        : secondDate.localeCompare(firstDate);
    });
  }, [
    patients,
    localSearch,
    filterStatus,
    sortOrder,
  ]);

  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPatients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPatients, currentPage]);
  const { clinicalHistoryStatuses, clinicalHistoryStatusesLoading } =
    usePatientClinicalHistoryStatuses(paginatedPatients);

  const visiblePatientIds = useMemo(
    () => paginatedPatients.map((patient) => patient.id),
    [paginatedPatients],
  );
  const selectedVisibleCount = visiblePatientIds.filter((id) => selectedPatientIds.has(id)).length;
  const visibleSelectionState: boolean | 'indeterminate' =
    selectedVisibleCount === visiblePatientIds.length && visiblePatientIds.length > 0
      ? true
      : selectedVisibleCount > 0
        ? 'indeterminate'
        : false;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [localSearch, filterStatus, sortOrder]);

  const handleOpenDialog = (patientId?: string) => {
    if (!can(patientId ? "patients.update" : "patients.create")) return;
    setCrearHistorial(false);
    if (patientId) {
      const patient = patients.find((p) => p.id === patientId);
      if (patient) {
        setFormData({ ...patient });
        setEditingPatient(patientId);
      }
    } else {
      setFormData(initialFormData);
      setEditingPatient(null);
    }
    setIsDialogOpen(true);
  };

  React.useEffect(() => {
    if (searchParams.get('action') !== 'newPatient') return;
    if (permissionsLoading) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('action');
    setSearchParams(nextSearchParams, { replace: true });

    if (!canCreatePatient) return;

    setCrearHistorial(false);
    setFormData(initialFormData);
    setEditingPatient(null);
    setIsDialogOpen(true);
  }, [canCreatePatient, permissionsLoading, searchParams, setSearchParams]);

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can(editingPatient ? "patients.update" : "patients.create")) return;
    if (!formData.nombres || !formData.apellidos) { toast.error('Nombres y Apellidos requeridos'); return; }
    setIsConfirmationOpen(true);
  };

  const handleSubmit = async () => {
    if (!can(editingPatient ? "patients.update" : "patients.create")) return;
    setIsFormLoading(true);
    try {
      const normalizedFormData = {
        ...formData,
        nombres: normalizePatientName(formData.nombres),
        apellidos: normalizePatientName(formData.apellidos),
      };

      if (editingPatient) {
        await updatePatient(editingPatient, normalizedFormData);
        toast.success('Paciente actualizado');
      } else {
        const newId = await addPatient(normalizedFormData);
        toast.success('Paciente creado');
        if (crearHistorial && can("patients.clinicalHistory.update")) setHistoryModalState({ isOpen: true, patientId: newId });
      }
      setIsDialogOpen(false);
      setEditingPatient(null);
    } catch (error) { toast.error('Error al guardar'); } 
    finally { setIsFormLoading(false); setIsConfirmationOpen(false); }
  };

  const togglePatientSelection = (patientId: string, checked: boolean) => {
    setSelectedPatientIds((current) => {
      const next = new Set(current);
      if (checked) next.add(patientId);
      else next.delete(patientId);
      return next;
    });
  };

  const toggleVisiblePatients = (checked: boolean) => {
    setSelectedPatientIds((current) => {
      const next = new Set(current);
      visiblePatientIds.forEach((patientId) => {
        if (checked) next.add(patientId);
        else next.delete(patientId);
      });
      return next;
    });
  };

  const updateSelectedPatientsStatus = async (
    status: 'activo' | 'inactivo',
    actionLabel: 'Activar' | 'Desactivar' | 'Eliminar',
  ) => {
    if (!can(actionLabel === 'Eliminar' ? 'patients.delete' : 'patients.update')) return;
    const selectedPatients = patients.filter(
      (patient) => selectedPatientIds.has(patient.id) && patient.estado !== status,
    );
    if (selectedPatients.length === 0) {
      toast.info('Los pacientes seleccionados ya tienen ese estado.');
      return;
    }

    const action = actionLabel.toLocaleLowerCase('es-MX');
    const confirmed = await confirm({
      title: `${actionLabel} pacientes`,
      description: `Se van a ${action} ${selectedPatients.length} pacientes. Sus datos e historial se conservarán.`,
      confirmLabel: actionLabel,
      destructive: status === 'inactivo',
    });
    if (!confirmed) return;

    setIsBulkUpdating(true);
    try {
      await Promise.all(
        selectedPatients.map((patient) => updatePatient(patient.id, { estado: status })),
      );
      setSelectedPatientIds(new Set());
      const singular = selectedPatients.length === 1;
      const result = actionLabel === 'Activar'
        ? singular ? 'activado' : 'activados'
        : actionLabel === 'Desactivar'
          ? singular ? 'desactivado' : 'desactivados'
          : singular ? 'eliminado del listado activo' : 'eliminados del listado activo';
      toast.success(`${selectedPatients.length} paciente${singular ? '' : 's'} ${result}.`);
    } catch {
      toast.error('No fue posible actualizar todos los pacientes.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleRemovePatient = async (patient: Patient) => {
    if (!canDeletePatient) return;
    const confirmed = await confirm({
      title: 'Eliminar paciente',
      description: `${patient.nombres} ${patient.apellidos} dejará de aparecer entre los pacientes activos. Sus datos e historial se conservarán.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await updatePatient(patient.id, { estado: 'inactivo' });
      setSelectedPatientIds((current) => {
        const next = new Set(current);
        next.delete(patient.id);
        return next;
      });
      toast.success('Paciente eliminado del listado activo');
    } catch {
      toast.error('No fue posible eliminar al paciente.');
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, [e.target.id]: e.target.value }));

  const PatientCard = ({ p }: { p: Patient }) => {
    const patientAge = calculatePatientAge(p.fechaNacimiento);
    const clinicalHistoryStatus: ClinicalHistoryStatus = clinicalHistoryStatuses.get(p.id) ?? 'none';
    const clinicalHistoryLabel = {
      none: 'Sin historial',
      incomplete: 'Historial incompleto',
      complete: 'Historial completo',
    }[clinicalHistoryStatus];
    const clinicalHistoryClassName = {
      none: 'border-muted-foreground/30 text-muted-foreground',
      incomplete: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
      complete: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    }[clinicalHistoryStatus];

    return (
      <div className="bg-card border rounded-xl p-4 hover:shadow-md transition-all flex flex-col justify-between gap-4 h-full">
        <div>
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3 items-center">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {p.nombres[0]}{p.apellidos[0]}
                    </div>
                    <div>
                        <h3 className="font-semibold text-base leading-tight line-clamp-1" title={`${p.nombres} ${p.apellidos}`}>
                            {p.nombres} {p.apellidos}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {patientAge === null ? 'Sin fecha de nacimiento' : `${patientAge} años`}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canManagePatientSelection && (
                    <Checkbox
                      checked={selectedPatientIds.has(p.id)}
                      onCheckedChange={(checked) => togglePatientSelection(p.id, checked === true)}
                      aria-label={`Seleccionar a ${p.nombres} ${p.apellidos}`}
                    />
                  )}
                  <Badge variant={p.estado === 'activo' ? 'default' : 'secondary'} className="capitalize">{p.estado}</Badge>
                </div>
            </div>
            
            <div className="space-y-1.5 text-sm text-muted-foreground">
                 <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" /> 
                    {p.telefonoPrincipal ? p.telefonoPrincipal : <span className="italic text-xs">Sin teléfono</span>}
                 </div>
                 {can("patients.clinicalHistory.view") && <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-3 w-3" />
                    <Badge variant="outline" className={`font-normal ${clinicalHistoryClassName}`}>
                      {clinicalHistoryStatusesLoading && !clinicalHistoryStatuses.has(p.id)
                        ? 'Sin historial'
                        : clinicalHistoryLabel}
                    </Badge>
                 </div>}
            </div>
        </div>

        <div className="pt-3 border-t flex gap-2 mt-auto">
            {can("patients.record.view") && (<Link to={`/pacientes/${p.id}`} className="flex-1">
                <Button className="w-full h-8" variant="outline" size="sm">
                    <Eye className="h-3.5 w-3.5 mr-2" /> Ver ficha
                </Button>
            </Link>)}
            {canUpdatePatient && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(p.id)} title="Editar" aria-label="Editar"><Edit className="h-3.5 w-3.5" /></Button>
            )}
            {canDeletePatient && p.estado === 'activo' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => void handleRemovePatient(p)}
                title="Eliminar paciente"
                aria-label={`Eliminar a ${p.nombres} ${p.apellidos}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
            <SectionHelp title="Pacientes">
              <p>Administra expedientes, historial clínico, cotizaciones y seguimiento de pacientes.</p>
            </SectionHelp>
          </div>
          <p className="text-muted-foreground">Directorio completo</p>
        </div>
        {canCreatePatient && (
          <Button onClick={() => handleOpenDialog()} size="lg" className="shadow-lg">
            <Plus className="h-5 w-5 mr-2" /> Nuevo Paciente
          </Button>
        )}
      </div>
      
      <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-sm shrink-0 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(14rem,1fr)_140px_150px_210px]">
        <div className="relative min-w-0 w-full sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Buscar nombre, correo o teléfono..."
                className="pl-9 bg-background"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
            />
        </div>

            <Select value={filterStatus} onValueChange={(value: 'all' | 'activo' | 'inactivo') => setFilterStatus(value)}>
                <SelectTrigger className="w-full bg-background" aria-label="Filtrar por estado">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="inactivo">Inactivos</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(value: PatientSortOrder) => setSortOrder(value)}>
                <SelectTrigger className="w-full bg-background" aria-label="Ordenar pacientes">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="recent">Más recientes</SelectItem>
                    <SelectItem value="oldest">Más antiguos</SelectItem>
                    <SelectItem value="alphabetical">Alfabético</SelectItem>
                </SelectContent>
            </Select>

            <div className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-3">
              <Checkbox
                checked={visibleSelectionState}
                onCheckedChange={(checked) => toggleVisiblePatients(checked === true)}
                disabled={!canManagePatientSelection || visiblePatientIds.length === 0}
                aria-label="Seleccionar pacientes visibles"
              />
              <span className="truncate text-sm font-medium">Seleccionar visibles</span>
              <SectionHelp title="Selección por lote">
                <p>Selecciona los pacientes mostrados en esta página para administrar su estado.</p>
              </SectionHelp>
            </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <ClipboardCheck className="h-4 w-4" />
          <span>Estado del historial</span>
          <SectionHelp title="Estado del historial clínico">
            <p>Sin historial: no hay información capturada.</p>
            <p>Incompleto: faltan datos en los dos primeros apartados.</p>
            <p>Completo: los primeros dos están completos y los cuatro siguientes contienen información.</p>
          </SectionHelp>
        </div>

        {selectedPatientIds.size > 0 && (
          <>
            <Badge variant="secondary" className="ml-auto">
              {selectedPatientIds.size} seleccionados
            </Badge>
            {canUpdatePatient && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void updateSelectedPatientsStatus('activo', 'Activar')}
                disabled={isBulkUpdating}
              >
                <UserCheck className="mr-1.5 h-4 w-4" /> Activar
              </Button>
            )}
            {canUpdatePatient && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void updateSelectedPatientsStatus('inactivo', 'Desactivar')}
                disabled={isBulkUpdating}
              >
                <UserX className="mr-1.5 h-4 w-4" /> Desactivar
              </Button>
            )}
            {canDeletePatient && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void updateSelectedPatientsStatus('inactivo', 'Eliminar')}
                disabled={isBulkUpdating}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPatientIds(new Set())}
              disabled={isBulkUpdating}
            >
              Limpiar
            </Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {patientsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
        ) : filteredPatients.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground flex flex-col items-center">
                <User className="h-12 w-12 mb-4 opacity-20" />
                <p>No se encontraron pacientes con esos filtros.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                {paginatedPatients.map(patient => (
                    <PatientCard key={patient.id} p={patient} />
                ))}
            </div>
        )}
      </div>

      {!patientsLoading && filteredPatients.length > 0 && (
          <div className="flex items-center justify-between border-t pt-4 shrink-0">
              <p className="text-sm text-muted-foreground hidden sm:block">
                  Mostrando {paginatedPatients.length} de {filteredPatients.length} pacientes
              </p>
              <div className="flex items-center gap-2 mx-auto sm:mx-0">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                      <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                      Página {currentPage} de {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                      <ChevronRight className="h-4 w-4" />
                  </Button>
              </div>
          </div>
      )}

      {/* Modal de Formulario */}
      <Dialog open={isDialogOpen && can(editingPatient ? "patients.update" : "patients.create")} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPatient ? 'Editar Paciente' : 'Registrar Nuevo Paciente'}</DialogTitle>
            <DialogDescription>Los campos marcados con * son obligatorios.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestSubmit} className="space-y-6 pt-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nombres">Nombres *</Label>
                    <Input id="nombres" value={formData.nombres} onChange={handleFormChange} required placeholder="Ej. Juan Carlos" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellidos">Apellidos *</Label>
                    <Input id="apellidos" value={formData.apellidos} onChange={handleFormChange} required placeholder="Ej. Pérez López" />
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="telefonoPrincipal">Teléfono (Opcional)</Label>
                    <Input id="telefonoPrincipal" value={formData.telefonoPrincipal} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fechaNacimiento">Fecha Nacimiento *</Label>
                    <Input id="fechaNacimiento" type="date" value={formData.fechaNacimiento} onChange={handleFormChange} required />
                  </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detalles Adicionales</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Sexo (Opcional)</Label>
                        <Select value={formData.sexo} onValueChange={(v: any) => setFormData(p => ({...p, sexo: v}))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="M">Masculino</SelectItem>
                                <SelectItem value="F">Femenino</SelectItem>
                                <SelectItem value="X">Otro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="estadoCivil">Estado civil (Opcional)</Label>
                        <Select
                          value={formData.estadoCivil || undefined}
                          onValueChange={(value) => setFormData((current) => ({ ...current, estadoCivil: value }))}
                        >
                            <SelectTrigger id="estadoCivil"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                                {formData.estadoCivil && !hasKnownMaritalStatus(formData.estadoCivil) && (
                                  <SelectItem value={formData.estadoCivil}>{formData.estadoCivil}</SelectItem>
                                )}
                                {MARITAL_STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status} value={status}>{status}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="correo">Correo electrónico (Opcional)</Label>
                        <Input id="correo" type="email" value={formData.correo} onChange={handleFormChange} />
                    </div>
                  </div>
              </div>

              {!editingPatient && can("patients.clinicalHistory.update") && (
                  <div className="flex items-center space-x-2 bg-primary/5 p-3 rounded-md border border-primary/20">
                    <Checkbox id="crearHistorial" checked={crearHistorial} onCheckedChange={(c) => setCrearHistorial(!!c)} />
                    <Label htmlFor="crearHistorial" className="cursor-pointer">Llenar Historia Clínica ahora mismo</Label>
                  </div>
              )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingPatient ? 'Guardar Cambios' : 'Registrar Paciente'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar datos?</AlertDialogTitle>
            <AlertDialogDescription>Se guardará la información del paciente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isFormLoading}>Confirmar Guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InitialHistoryModal isOpen={historyModalState.isOpen && can("patients.clinicalHistory.update")} patientId={historyModalState.patientId} onClose={() => setHistoryModalState({ isOpen: false, patientId: null })} />
      {confirmationDialog}
    </div>
  );
};

export default Pacientes;
