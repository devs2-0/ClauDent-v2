import React from 'react';
import { IApnp } from '@/state/AppContext';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface Props {
  formData: IApnp;
  setFormData: (updater: React.SetStateAction<IApnp>) => void;
}

const FormApnp: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleCheckboxChange = (id: keyof IApnp, checked: boolean) => {
    setFormData(prev => ({ ...prev, [id]: checked }));
  };

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="frecuencia_cepillado">Frecuencia de Cepillado</Label>
          <Input id="frecuencia_cepillado" value={formData.frecuencia_cepillado} onChange={handleChange} placeholder="Ej. 3 veces al día" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grupo_sanguineo">Grupo Sanguíneo</Label>
          <Input id="grupo_sanguineo" value={formData.grupo_sanguineo} onChange={handleChange} placeholder="Ej. O+" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="auxiliares_higiene" checked={formData.auxiliares_higiene} onCheckedChange={(v) => handleCheckboxChange('auxiliares_higiene', !!v)} />
          <Label htmlFor="auxiliares_higiene">Usa auxiliares de higiene (hilo dental, enjuague...)</Label>
        </div>
        {formData.auxiliares_higiene && (
          <div className="pl-6 space-y-2">
            <Label htmlFor="auxiliares_cuales">¿Cuáles?</Label>
            <Input id="auxiliares_cuales" value={formData.auxiliares_cuales} onChange={handleChange} />
          </div>
        )}
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="come_entre_comidas" checked={formData.come_entre_comidas} onCheckedChange={(v) => handleCheckboxChange('come_entre_comidas', !!v)} />
          <Label htmlFor="come_entre_comidas">¿Come entre comidas?</Label>
        </div>
      </div>
      <Separator />
      <div className="space-y-4">
        <Label>Adicciones</Label>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="adic_tabaco" checked={formData.adic_tabaco} onCheckedChange={(v) => handleCheckboxChange('adic_tabaco', !!v)} />
            <Label htmlFor="adic_tabaco">Tabaco</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="adic_alcohol" checked={formData.adic_alcohol} onCheckedChange={(v) => handleCheckboxChange('adic_alcohol', !!v)} />
            <Label htmlFor="adic_alcohol">Alcohol</Label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormApnp;