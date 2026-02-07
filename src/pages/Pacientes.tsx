// RF02-RF05: Patients list (CORREGIDO: BUG DE ALERTDIALOG)
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, Filter, User, Phone, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useApp, Patient } from '@/state/AppContext';
import { calculateAge } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import InitialHistoryModal from '@/components/InitialHistoryModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const initialFormData: Omit<Patient, 'id' | 'fechaRegistro'> = {
  nombres: '', apellidos: '', fechaNacimiento: '', sexo: 'X', telefonoPrincipal: '', telefonoContacto: '', correo: '', curp: '', direccion: '', calle: '', numeroExterior: '', numeroInterior: '', colonia: '', municipio: '', estadoDireccion: '', estadoCivil: '', estado: 'activo',
};

const ITEMS_PER_PAGE = 12;

const Pacientes: React.FC = () => {
  const { patients, addPatient, updatePatient, deletePatient, searchQuery, patientsLoading } = useApp();
  
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [filterStatus, setFilterStatus] = useState<'all' | 'activo' | 'inactivo'>('all');
  const [dateFilter, setDateFilter] = useState<string>(''); 

  const [currentPage, setCurrentPage] = useState(1);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<string | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [crearHistorial, setCrearHistorial] = useState(false);
  
  const [historyModalState, setHistoryModalState] = useState<{isOpen: boolean; patientId: string | null}>({ isOpen: false, patientId: null });
  const [formData, setFormData] = useState<Omit<Patient, 'id' | 'fechaRegistro'>>(initialFormData);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const searchLower = localSearch.toLowerCase();
      const matchesSearch =
        patient.nombres.toLowerCase().includes(searchLower) ||
        patient.apellidos.toLowerCase().includes(searchLower) ||
        (patient.curp && patient.curp.toLowerCase().includes(searchLower));
      
      const matchesStatus = filterStatus === 'all' || patient.estado === filterStatus;
      const matchesDate = !dateFilter || patient.fechaRegistro === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [patients, localSearch, filterStatus, dateFilter]);

  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPatients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPatients, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [localSearch, filterStatus, dateFilter]);

  const handleOpenDialog = (patientId?: string) => {
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

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombres || !formData.apellidos) { toast.error('Nombres y Apellidos requeridos'); return; }
    setIsConfirmationOpen(true);
  };

  const handleSubmit = async () => {
    setIsFormLoading(true);
    try {
      if (editingPatient) {
        await updatePatient(editingPatient, formData);
        toast.success('Paciente actualizado');
      } else {
        const newId = await addPatient(formData);
        toast.success('Paciente creado');
        if (crearHistorial) setHistoryModalState({ isOpen: true, patientId: newId });
      }
      setIsDialogOpen(false);
      setEditingPatient(null);
    } catch (error) { toast.error('Error al guardar'); } 
    finally { setIsFormLoading(false); setIsConfirmationOpen(false); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar paciente permanentemente?')) {
      await deletePatient(id);
      toast.success('Paciente eliminado');
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, [e.target.id]: e.target.value }));

  const PatientCard = ({ p }: { p: Patient }) => (
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
                            <User className="h-3 w-3" /> {calculateAge(p.fechaNacimiento)} años
                        </p>
                    </div>
                </div>
                <Badge variant={p.estado === 'activo' ? 'default' : 'secondary'} className="shrink-0">{p.estado}</Badge>
            </div>
            
            <div className="space-y-1.5 text-sm text-muted-foreground">
                 <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" /> 
                    {p.telefonoPrincipal ? p.telefonoPrincipal : <span className="italic text-xs">Sin teléfono</span>}
                 </div>
                 <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" /> 
                    Reg: {p.fechaRegistro}
                 </div>
            </div>
        </div>

        <div className="pt-3 border-t flex gap-2 mt-auto">
            <Link to={`/pacientes/${p.id}`} className="flex-1">
                <Button className="w-full h-8" variant="outline" size="sm">
                    <Eye className="h-3.5 w-3.5 mr-2" /> Ficha
                </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(p.id)} title="Editar"><Edit className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
    </div>
  );

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground">Directorio completo</p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="lg" className="shadow-lg">
          <Plus className="h-5 w-5 mr-2" /> Nuevo Paciente
        </Button>
      </div>
      
      <div className="flex flex-col md:flex-row gap-3 items-center bg-card p-4 rounded-lg border shadow-sm shrink-0">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Buscar por nombre..." 
                className="pl-9 bg-background" 
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
            />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            <div className="relative min-w-[150px]">
                <Input 
                    type="date" 
                    value={dateFilter} 
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-background"
                />
                {dateFilter && (
                    <Button 
                        variant="ghost" size="icon" 
                        className="absolute right-8 top-1/2 -translate-y-1/2 h-6 w-6"
                        onClick={() => setDateFilter('')}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                )}
            </div>

            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-[130px] bg-background">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
            </Select>
        </div>
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
                {dateFilter && <Button variant="link" onClick={() => setDateFilter('')}>Limpiar fecha</Button>}
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPatient ? 'Editar Paciente' : 'Registrar Nuevo Paciente'}</DialogTitle>
            <DialogDescription>Los campos marcados con * son obligatorios.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestSubmit} className="space-y-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombres">Nombres *</Label>
                    <Input id="nombres" value={formData.nombres} onChange={handleFormChange} required placeholder="Ej. Juan Carlos" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellidos">Apellidos *</Label>
                    <Input id="apellidos" value={formData.apellidos} onChange={handleFormChange} required placeholder="Ej. Pérez López" />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefonoPrincipal">Teléfono</Label>
                    <Input id="telefonoPrincipal" value={formData.telefonoPrincipal} onChange={handleFormChange} placeholder="Opcional" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fechaNacimiento">Fecha Nacimiento *</Label>
                    <Input id="fechaNacimiento" type="date" value={formData.fechaNacimiento} onChange={handleFormChange} required />
                  </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detalles Adicionales</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Sexo</Label>
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
                        <Label>Estado Civil</Label>
                        <Input id="estadoCivil" value={formData.estadoCivil} onChange={handleFormChange} />
                    </div>
                    <div className="col-span-2 space-y-2">
                        <Label>Correo Electrónico</Label>
                        <Input id="correo" type="email" value={formData.correo} onChange={handleFormChange} />
                    </div>
                  </div>
              </div>

              {!editingPatient && (
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

      <InitialHistoryModal isOpen={historyModalState.isOpen} patientId={historyModalState.patientId} onClose={() => setHistoryModalState({ isOpen: false, patientId: null })} />
    </div>
  );
};

export default Pacientes;