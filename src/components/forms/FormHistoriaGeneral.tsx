import React from 'react';
import { IHistoriaGeneral } from '@/state/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ¡CORREGIDO! La interfaz de Props ahora acepta la función 'updater'
interface Props {
  formData: IHistoriaGeneral;
  setFormData: (updater: React.SetStateAction<IHistoriaGeneral>) => void;
}

const FormHistoriaGeneral: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      <div className="space-y-2">
        <Label htmlFor="ocupacion">Ocupación</Label>
        <Input id="ocupacion" value={formData.ocupacion} onChange={handleChange} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="escolaridad">Escolaridad</Label>
        <Input id="escolaridad" value={formData.escolaridad} onChange={handleChange} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="estado_civil">Estado Civil</Label>
        <Input id="estado_civil" value={formData.estado_civil} onChange={handleChange} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono (Adicional)</Label>
        <Input id="telefono" value={formData.telefono} onChange={handleChange} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fecha_ult_consulta_medica">Última Consulta Médica</Label>
        <Input id="fecha_ult_consulta_medica" type="date" value={formData.fecha_ult_consulta_medica} onChange={handleChange} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="motivo_ult_consulta_medica">Motivo</Label>
        <Input id="motivo_ult_consulta_medica" value={formData.motivo_ult_consulta_medica} onChange={handleChange} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fecha_ult_consulta_odontologica">Última Consulta Odontológica</Label>
        <Input id="fecha_ult_consulta_odontologica" type="date" value={formData.fecha_ult_consulta_odontologica} onChange={handleChange} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="motivo_ult_consulta_odontologica">Motivo</Label>
        <Input id="motivo_ult_consulta_odontologica" value={formData.motivo_ult_consulta_odontologica} onChange={handleChange} />
      </div>
    </div>
  );
};

export default FormHistoriaGeneral;