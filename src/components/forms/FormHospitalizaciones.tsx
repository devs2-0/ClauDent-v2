import React from 'react';
import { IHospitalizaciones } from '@/state/AppContext';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  formData: IHospitalizaciones;
  setFormData: (updater: React.SetStateAction<IHospitalizaciones>) => void;
}

const FormHospitalizaciones: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="ha_sido_hospitalizado" 
          checked={formData.ha_sido_hospitalizado} 
          onCheckedChange={(v) => setFormData(prev => ({...prev, ha_sido_hospitalizado: !!v}))} 
        />
        <Label htmlFor="ha_sido_hospitalizado">¿Ha sido hospitalizado en los últimos 5 años?</Label>
      </div>
      {formData.ha_sido_hospitalizado && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha (Aprox.)</Label>
            <Input id="fecha" type="date" value={formData.fecha} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea id="motivo" value={formData.motivo} onChange={handleChange} rows={2} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FormHospitalizaciones;