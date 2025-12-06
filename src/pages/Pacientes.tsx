// RF02-RF05: Patients list (RESPONSIVE HEIGHT)
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, Filter } from 'lucide-react';
import { useApp, Patient } from '@/state/AppContext';
import { calculateAge } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import InitialHistoryModal from '@/components/InitialHistoryModal';

const initialFormData: Omit<Patient, 'id' | 'fechaRegistro'> = {
  nombres: '',
  apellidos: '',
  fechaNacimiento: '',
  sexo: 'X',
  telefonoPrincipal: '',
  telefonoContacto: '',
  correo: '',
  curp: '',
  direccion: '',
  calle: '',
  numeroExterior: '',
  numeroInterior: '',
  colonia: '',
  municipio: '',
  estadoDireccion: '',
  estadoCivil: '',
  estado: 'activo',
};

const Pacientes: React.FC = () => {
  const { patients, addPatient, updatePatient, deletePatient, searchQuery, setSearchQuery, patientsLoading } = useApp();
  
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [filterStatus, setFilterStatus] = useState<'all' | 'activo' | 'inactivo'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<string | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false); 
  const [crearHistorial, setCrearHistorial] = useState(false);
  
  const [historyModalState, setHistoryModalState] = useState<{isOpen: boolean; patientId: string | null}>({
    isOpen: false,
    patientId: null,
  });

  const [formData, setFormData] = useState<Omit<Patient, 'id' | 'fechaRegistro'>>(initialFormData);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch =
        patient.nombres.toLowerCase().includes(localSearch.toLowerCase()) ||
        patient.apellidos.toLowerCase().includes(localSearch.toLowerCase()) ||
        (patient.curp && patient.curp.toLowerCase().includes(localSearch.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || patient.estado === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [patients, localSearch, filterStatus]);

  const handleOpenDialog = (patientId?: string) => {
    setCrearHistorial(false);
    if (patientId) {
      const patient = patients.find((p) => p.id === patientId);
      if (patient) {
        setFormData({
          nombres: patient.nombres,
          apellidos: patient.apellidos,
          fechaNacimiento: patient.fechaNacimiento,
          sexo: patient.sexo,
          telefonoPrincipal: patient.telefonoPrincipal,
          telefonoContacto: patient.telefonoContacto || '',
          correo: patient.correo || '',
          curp: patient.curp || '',
          direccion: patient.direccion || '',
          calle: patient.calle || '',
          numeroExterior: patient.numeroExterior || '',
          numeroInterior: patient.numeroInterior || '',
          colonia: patient.colonia || '',
          municipio: patient.municipio || '',
          estadoDireccion: patient.estadoDireccion || '',
          estadoCivil: patient.estadoCivil || '',
          estado: patient.estado,
        });
        setEditingPatient(patientId);
      }
    } else {
      setFormData(initialFormData);
      setEditingPatient(null);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormLoading(true);
    
    if (!formData.nombres || !formData.apellidos || !formData.fechaNacimiento) {
      toast.error("Nombres, Apellidos y Fecha de Nacimiento son obligatorios.");
      setIsFormLoading(false);
      return;
    }

    try {
      if (editingPatient) {
        const { ...updates } = formData;
        await updatePatient(editingPatient, updates);
        toast.success('Paciente actualizado correctamente');
      } else {
        const newPatientId = await addPatient(formData);
        toast.success('Paciente creado correctamente');

        if (crearHistorial) {
          setHistoryModalState({ isOpen: true, patientId: newPatientId });
        }
      }
      setIsDialogOpen(false);
      setEditingPatient(null);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el paciente');
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este paciente?')) {
      setIsFormLoading(true);
      try {
        await deletePatient(id);
        toast.success('Paciente eliminado correctamente');
      } catch (error) {
        console.error(error);
        toast.error('Error al eliminar el paciente');
      } finally {
        setIsFormLoading(false);
      }
    }
  };

  const TableLoadingSkeleton = () => (
    Array(5).fill(0).map((_, index) => (
      <TableRow key={index}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </TableCell>
      </TableRow>
    ))
  );
  
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground">Gestiona los pacientes del consultorio</p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Paciente
        </Button>
      </div>
      
      <Card className="shrink-0">
        <CardHeader className="py-3">
          <CardTitle className="text-lg">Filtros y Búsqueda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 pb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre, apellido o CURP..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="inactivo">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 overflow-hidden">
          {/* ¡ALTURA DINÁMICA AQUÍ! */}
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Paciente</TableHead>
                  <TableHead className="whitespace-nowrap">CURP</TableHead>
                  <TableHead className="whitespace-nowrap">Edad</TableHead>
                  <TableHead className="whitespace-nowrap">Teléfono</TableHead>
                  <TableHead className="whitespace-nowrap">Correo</TableHead>
                  <TableHead className="whitespace-nowrap">Estado</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patientsLoading ? (
                  <TableLoadingSkeleton />
                ) : filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      No se encontraron pacientes.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {patient.nombres} {patient.apellidos}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{patient.curp || 'N/A'}</TableCell>
                      <TableCell className="whitespace-nowrap">{calculateAge(patient.fechaNacimiento)} años</TableCell>
                      <TableCell className="whitespace-nowrap">{patient.telefonoPrincipal || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{patient.correo || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={patient.estado === 'activo' ? 'default' : 'secondary'}>
                          {patient.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Link to={`/pacientes/${patient.id}`}>
                            <Button variant="ghost" size="icon" aria-label="Ver ficha">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(patient.id)}
                            aria-label="Editar"
                            disabled={isFormLoading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(patient.id)}
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

      {/* Dialog (Sin cambios en lógica) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* ... (Mismo contenido del modal anterior) ... */}
           <DialogHeader>
            <DialogTitle>{editingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}</DialogTitle>
            <DialogDescription>
              {editingPatient ? 'Modifica los datos del paciente' : 'Ingresa los datos del nuevo paciente'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <fieldset disabled={isFormLoading} className="space-y-6">
              
              {/* --- Datos Personales --- */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Datos Personales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombres">Nombres *</Label>
                    <Input id="nombres" value={formData.nombres} onChange={handleFormChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellidos">Apellidos *</Label>
                    <Input id="apellidos" value={formData.apellidos} onChange={handleFormChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fechaNacimiento">Fecha de Nacimiento *</Label>
                    <Input id="fechaNacimiento" type="date" value={formData.fechaNacimiento} onChange={handleFormChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sexo">Sexo</Label>
                    <Select value={formData.sexo} onValueChange={(v) => handleSelectChange('sexo', v)}>
                      <SelectTrigger id="sexo"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                        <SelectItem value="X">No especificar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="curp">CURP</Label>
                    <Input id="curp" value={formData.curp} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estadoCivil">Estado Civil</Label>
                    <Input id="estadoCivil" value={formData.estadoCivil} onChange={handleFormChange} />
                  </div>
                </div>
              </div>
              
              <Separator />

              {/* --- Datos de Contacto --- */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Datos de Contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefonoPrincipal">Teléfono Principal</Label>
                    <Input id="telefonoPrincipal" value={formData.telefonoPrincipal} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefonoContacto">Teléfono de Contacto (Opcional)</Label>
                    <Input id="telefonoContacto" value={formData.telefonoContacto} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="correo">Correo Electrónico</Label>
                    <Input id="correo" type="email" value={formData.correo} onChange={handleFormChange} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* --- Dirección --- */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Dirección (Opcional)</h3>
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección (Línea 1)</Label>
                  <Input id="direccion" value={formData.direccion} onChange={handleFormChange} placeholder="Ej. Av. Siempre Viva 123" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calle">Calle</Label>
                    <Input id="calle" value={formData.calle} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numeroExterior">Num. Exterior</Label>
                    <Input id="numeroExterior" value={formData.numeroExterior} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numeroInterior">Num. Interior</Label>
                    <Input id="numeroInterior" value={formData.numeroInterior} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="colonia">Colonia</Label>
                    <Input id="colonia" value={formData.colonia} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="municipio">Municipio / Delegación</Label>
                    <Input id="municipio" value={formData.municipio} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estadoDireccion">Estado</Label>
                    <Input id="estadoDireccion" value={formData.estadoDireccion} onChange={handleFormChange} />
                  </div>
                </div>
              </div>
              
              <Separator />

              {/* --- Opciones del Sistema --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado del Paciente</Label>
                  <Select value={formData.estado} onValueChange={(v) => handleSelectChange('estado', v)}>
                    <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!editingPatient && (
                  <div className="flex items-center space-x-2 pt-4">
                    <Checkbox
                      id="crearHistorial"
                      checked={crearHistorial}
                      onCheckedChange={(checked) => setCrearHistorial(!!checked)}
                    />
                    <Label
                      htmlFor="crearHistorial"
                      className="text-sm font-medium leading-none"
                    >
                      Crear primera entrada de historial clínico
                    </Label>
                  </div>
                )}
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
                  : editingPatient
                  ? 'Guardar Cambios'
                  : 'Crear Paciente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <InitialHistoryModal 
        isOpen={historyModalState.isOpen}
        patientId={historyModalState.patientId}
        onClose={() => setHistoryModalState({ isOpen: false, patientId: null })}
      />
    </div>
  );
};

export default Pacientes;