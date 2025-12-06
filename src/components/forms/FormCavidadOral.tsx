import React from 'react';
import { ICavidadOral } from '@/state/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  formData: ICavidadOral;
  setFormData: (updater: React.SetStateAction<ICavidadOral>) => void;
}

const FormCavidadOral: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  // ¡CORREGIDO! Este array es solo de strings, no de 'keyof ICavidadOral'
  const items: { key: string, label: string }[] = [
    { key: 'labio', label: 'Labios' },
    { key: 'comisuras', label: 'Comisuras' },
    { key: 'carrillos', label: 'Carrillos' },
    { key: 'fondo_de_saco', label: 'Fondo de Saco' },
    { key: 'frenillos', label: 'Frenillos' },
    { key: 'paladar', label: 'Paladar' },
    { key: 'lengua', label: 'Lengua' },
    { key: 'piso_boca', label: 'Piso de Boca' },
    { key: 'dientes', label: 'Dientes (General)' },
    { key: 'encia', label: 'Encía' }
  ];

  return (
    <div className="space-y-4 p-4">
      {items.map(item => (
        <div key={item.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <Label htmlFor={`${item.key}_estado`} className="capitalize">{item.label}</Label>
          <div className="flex gap-2">
            <Input 
              id={`${item.key}_estado`} 
              // ¡CORREGIDO! Usamos 'as keyof' para ayudar a TS
              value={formData[`${item.key}_estado` as keyof ICavidadOral]} 
              onChange={handleChange}
              placeholder="Estado (Ej. Normal)"
              className="flex-1"
            />
            <Input 
              id={`${item.key}_nota`} 
              value={formData[`${item.key}_nota` as keyof ICavidadOral]} 
              onChange={handleChange}
              placeholder="Notas..."
              className="flex-1"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default FormCavidadOral;