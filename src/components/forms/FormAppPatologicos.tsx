import React from 'react';
import { IAppPatologicos } from '@/state/AppContext';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  formData: IAppPatologicos;
  setFormData: (updater: React.SetStateAction<IAppPatologicos>) => void;
}

const FormAppPatologicos: React.FC<Props> = ({ formData, setFormData }) => {
  const handleCheckboxChange = (id: keyof IAppPatologicos, checked: boolean) => {
    setFormData(prev => ({ ...prev, [id]: checked }));
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="ets" checked={formData.ets} onCheckedChange={(v) => handleCheckboxChange('ets', !!v)} />
          <Label htmlFor="ets">ETS</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="degenerativas" checked={formData.degenerativas} onCheckedChange={(v) => handleCheckboxChange('degenerativas', !!v)} />
          <Label htmlFor="degenerativas">Degenerativas</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="neoplasicas" checked={formData.neoplasicas} onCheckedChange={(v) => handleCheckboxChange('neoplasicas', !!v)} />
          <Label htmlFor="neoplasicas">Neoplásicas</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="congenitas" checked={formData.congenitas} onCheckedChange={(v) => handleCheckboxChange('congenitas', !!v)} />
          <Label htmlFor="congenitas">Congénitas</Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="otras">Otras</Label>
        <Textarea id="otras" value={formData.otras} onChange={(e) => setFormData(prev => ({...prev, otras: e.target.value}))} rows={3} />
      </div>
    </div>
  );
};

export default FormAppPatologicos;