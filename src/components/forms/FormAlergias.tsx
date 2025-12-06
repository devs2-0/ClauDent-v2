import React from 'react';
import { IAlergias } from '@/state/AppContext';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  formData: IAlergias;
  setFormData: (updater: React.SetStateAction<IAlergias>) => void;
}

const FormAlergias: React.FC<Props> = ({ formData, setFormData }) => {
  const handleCheckboxChange = (id: keyof IAlergias, checked: boolean) => {
    setFormData(prev => ({ ...prev, [id]: checked }));
  };

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm font-medium">¿Es alérgico a alguno de los siguientes?</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="antibioticos" checked={formData.antibioticos} onCheckedChange={(v) => handleCheckboxChange('antibioticos', !!v)} />
          <Label htmlFor="antibioticos">Antibióticos</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="analgesicos" checked={formData.analgesicos} onCheckedChange={(v) => handleCheckboxChange('analgesicos', !!v)} />
          <Label htmlFor="analgesicos">Analgésicos</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="anestesicos" checked={formData.anestesicos} onCheckedChange={(v) => handleCheckboxChange('anestesicos', !!v)} />
          <Label htmlFor="anestesicos">Anestésicos</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="alimentos" checked={formData.alimentos} onCheckedChange={(v) => handleCheckboxChange('alimentos', !!v)} />
          <Label htmlFor="alimentos">Alimentos</Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="especificar">Especificar otras alergias</Label>
        <Textarea id="especificar" value={formData.especificar} onChange={(e) => setFormData(prev => ({...prev, especificar: e.target.value}))} rows={3} />
      </div>
    </div>
  );
};

export default FormAlergias;