import React from 'react';
import { ISignosVitales } from '@/state/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  formData: ISignosVitales;
  setFormData: (updater: React.SetStateAction<ISignosVitales>) => void;
}

const FormSignosVitales: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4">
      <div className="space-y-2">
        <Label htmlFor="peso_kg">Peso (kg)</Label>
        <Input id="peso_kg" value={formData.peso_kg} onChange={handleChange} placeholder="Ej. 70.5" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="talla_m">Talla (m)</Label>
        <Input id="talla_m" value={formData.talla_m} onChange={handleChange} placeholder="Ej. 1.75" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="frecuencia_cardiaca">Frec. Cardiaca (lpm)</Label>
        <Input id="frecuencia_cardiaca" value={formData.frecuencia_cardiaca} onChange={handleChange} placeholder="Ej. 80" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="frecuencia_respiratoria">Frec. Respiratoria (rpm)</Label>
        <Input id="frecuencia_respiratoria" value={formData.frecuencia_respiratoria} onChange={handleChange} placeholder="Ej. 16" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tension_arterial_sistolica">T.A. Sistólica (mmHg)</Label>
        <Input id="tension_arterial_sistolica" value={formData.tension_arterial_sistolica} onChange={handleChange} placeholder="Ej. 120" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tension_arterial_diastolica">T.A. Diastólica (mmHg)</Label>
        <Input id="tension_arterial_diastolica" value={formData.tension_arterial_diastolica} onChange={handleChange} placeholder="Ej. 80" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="temperatura_c">Temperatura (°C)</Label>
        <Input id="temperatura_c" value={formData.temperatura_c} onChange={handleChange} placeholder="Ej. 36.5" />
      </div>
    </div>
  );
};

export default FormSignosVitales;