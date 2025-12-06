import React from 'react';
import { IAntecedentesHereditarios } from '@/state/AppContext';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  formData: IAntecedentesHereditarios;
  setFormData: (updater: React.SetStateAction<IAntecedentesHereditarios>) => void;
}

const FormAntecedentesHereditarios: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      <div className="space-y-2">
        <Label htmlFor="madre">Madre (Padecimientos)</Label>
        <Textarea id="madre" value={formData.madre} onChange={handleChange} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="padre">Padre (Padecimientos)</Label>
        <Textarea id="padre" value={formData.padre} onChange={handleChange} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hermanos">Hermanos (Padecimientos)</Label>
        <Textarea id="hermanos" value={formData.hermanos} onChange={handleChange} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hijos">Hijos (Padecimientos)</Label>
        <Textarea id="hijos" value={formData.hijos} onChange={handleChange} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="esposo">Esposo(a) (Padecimientos)</Label>
        <Textarea id="esposo" value={formData.esposo} onChange={handleChange} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tios">Tíos (Padecimientos)</Label>
        <Textarea id="tios" value={formData.tios} onChange={handleChange} rows={2} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="abuelos">Abuelos (Padecimientos)</Label>
        <Textarea id="abuelos" value={formData.abuelos} onChange={handleChange} rows={2} />
      </div>
    </div>
  );
};

export default FormAntecedentesHereditarios;