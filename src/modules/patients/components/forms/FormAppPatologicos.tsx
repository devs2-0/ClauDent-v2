import React from 'react';
import { IAppPatologicos } from '@/modules/patients';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

interface Props {
  formData: IAppPatologicos;
  setFormData: (updater: React.SetStateAction<IAppPatologicos>) => void;
}

const FormAppPatologicos: React.FC<Props> = ({ formData, setFormData }) => {
  const hasLegacyPadecimientos = formData.ets || formData.degenerativas || formData.neoplasicas || formData.congenitas || Boolean(formData.otras.trim());
  const padecimientosValue = formData.padecimientos === 'denied'
    ? 'denied'
    : formData.padecimientos === true || (formData.padecimientos == null && hasLegacyPadecimientos)
      ? 'true'
      : formData.padecimientos === false
        ? 'false'
        : '';

  const updatePadecimientos = (value: string) => {
    setFormData((current) => ({
      ...current,
      padecimientos: value === 'denied' ? 'denied' : value === 'true',
      ...(value === 'true' ? {} : {
        ets: false,
        degenerativas: false,
        neoplasicas: false,
        congenitas: false,
        otras: '',
      }),
    }));
  };

  const handleCheckboxChange = (id: keyof IAppPatologicos, checked: boolean) => {
    setFormData(prev => ({ ...prev, [id]: checked }));
  };

  return (
    <div className="space-y-4 p-4">
      <div className="max-w-md space-y-2">
        <Label htmlFor="padecimientos">¿El paciente presenta padecimientos?</Label>
        <Select value={padecimientosValue} onValueChange={updatePadecimientos}>
          <SelectTrigger id="padecimientos"><SelectValue placeholder="Sin registrar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Sí</SelectItem>
            <SelectItem value="false">No</SelectItem>
            <SelectItem value="denied">Paciente niega padecimientos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {padecimientosValue === 'true' && <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
      </div>}
      {padecimientosValue === 'true' && <div className="space-y-2">
        <Label htmlFor="otras">Otras</Label>
        <Textarea id="otras" value={formData.otras} onChange={(e) => setFormData(prev => ({...prev, otras: e.target.value}))} rows={3} />
      </div>}
    </div>
  );
};

export default FormAppPatologicos;
