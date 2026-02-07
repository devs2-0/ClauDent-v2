// Patient data form (CORREGIDO)
import React, { useState } from 'react';
import { Patient } from '@/state/AppContext';
import { useApp } from '@/state/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface PatientDataProps {
  patient: Patient;
}

// ¡NUEVO! Función para mapear los datos del paciente al estado del formulario
const mapPatientToFormData = (patient: Patient) => ({
  nombres: patient.nombres || '',
  apellidos: patient.apellidos || '',
  fechaNacimiento: patient.fechaNacimiento || '',
  sexo: patient.sexo || 'X',
  telefonoPrincipal: patient.telefonoPrincipal || '',
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
  estado: patient.estado || 'activo',
});

const PatientData: React.FC<PatientDataProps> = ({ patient }) => {
  const { updatePatient } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  
  // ¡MODIFICADO! Usamos la nueva estructura de datos
  const [formData, setFormData] = useState(mapPatientToFormData(patient));

  const handleSave = async () => {
    try {
      await updatePatient(patient.id, formData);
      setIsEditing(false);
      toast.success('Datos actualizados correctamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar los datos');
    }
  };

  const handleCancel = () => {
    // Resetea el formulario a los datos originales del paciente
    setFormData(mapPatientToFormData(patient));
    setIsEditing(false);
  };
  
  // Helper para manejar los inputs
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  // Helper para los Select
  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Información Personal</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Guardar Cambios</Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Editar</Button>
          )}
        </div>
      </div>

      {/* ¡MODIFICADO! Formulario actualizado a los nuevos campos */}
      <fieldset disabled={!isEditing} className="space-y-6">
        {/* --- Datos Personales --- */}
        <div className="space-y-4">
          <h4 className="text-base font-medium text-muted-foreground">Datos Personales</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <Label htmlFor="sexo">Sexo *</Label>
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
          <h4 className="text-base font-medium text-muted-foreground">Datos de Contacto</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="telefonoPrincipal">Teléfono Principal *</Label>
              <Input id="telefonoPrincipal" value={formData.telefonoPrincipal} onChange={handleFormChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefonoContacto">Teléfono de Contacto</Label>
              <Input id="telefonoContacto" value={formData.telefonoContacto} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo">Correo Electrónico *</Label>
              <Input id="correo" type="email" value={formData.correo} onChange={handleFormChange} required />
            </div>
          </div>
        </div>

        <Separator />

        {/* --- Dirección --- */}
        <div className="space-y-4">
          <h4 className="text-base font-medium text-muted-foreground">Dirección (Opcional)</h4>
          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección (Línea 1)</Label>
            <Input id="direccion" value={formData.direccion} onChange={handleFormChange} placeholder="Ej. Av. Siempre Viva 123" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>
      </fieldset>
    </div>
  );
};

export default PatientData;