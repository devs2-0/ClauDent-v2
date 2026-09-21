import React from 'react';
import { IApnp } from '@/modules/patients';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Separator } from '@/shared/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

interface Props {
  formData: IApnp;
  setFormData: (updater: React.SetStateAction<IApnp>) => void;
}

const FormApnp: React.FC<Props> = ({ formData, setFormData }) => {
  const hygieneOptions = ['Hilo dental', 'Enjuague bucal', 'No usa auxiliares', 'Otros'];
  const legacyHygieneText = formData.auxiliares_cuales ?? '';
  const selectedOptions = formData.auxiliares_opciones ?? (legacyHygieneText.trim() ? ['Otros'] : []);
  const otherText = formData.auxiliares_otros ?? (formData.auxiliares_opciones ? '' : legacyHygieneText);
  const updateHygiene = (options: string[], other = otherText) => setFormData((current) => ({
    ...current,
    auxiliares_opciones: options,
    auxiliares_otros: other,
    auxiliares_cuales: options.map((option) => option === 'Otros' ? other.trim() || 'Otros' : option).join(', '),
  }));
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
          <Label htmlFor="auxiliares_higiene">Registrar auxiliares de higiene</Label>
        </div>
        {formData.auxiliares_higiene && (
          <div className="pl-6 space-y-3">
            <p className="text-sm text-muted-foreground">Selecciona una o varias opciones.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {hygieneOptions.map((option, index) => <div key={option} className="flex items-center gap-2">
                <Checkbox id={`higiene-${index}`} checked={selectedOptions.includes(option)} onCheckedChange={(checked) => {
                  const next = checked === true
                    ? option === 'No usa auxiliares' ? [option] : [...selectedOptions.filter((item) => item !== 'No usa auxiliares'), option]
                    : selectedOptions.filter((item) => item !== option);
                  updateHygiene(next);
                }} />
                <Label htmlFor={`higiene-${index}`}>{option}</Label>
              </div>)}
            </div>
            {selectedOptions.includes('Otros') && <div className="space-y-2">
              <Label htmlFor="auxiliares_otros">Otros auxiliares (especificar)</Label>
              <Input id="auxiliares_otros" value={otherText} onChange={(event) => updateHygiene(selectedOptions, event.target.value)} />
            </div>}
          </div>
        )}
      </div>
      <Separator />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cartilla-vacunacion">¿Cuenta con cartilla de vacunación?</Label>
          <Select value={formData.cartilla_vacunacion == null ? '' : String(formData.cartilla_vacunacion)} onValueChange={(value) => setFormData((current) => ({ ...current, cartilla_vacunacion: value === 'true', ...(value === 'false' ? { esquema_vacunacion_completo: null } : {}) }))}>
            <SelectTrigger id="cartilla-vacunacion"><SelectValue placeholder="Sin registrar" /></SelectTrigger>
            <SelectContent><SelectItem value="true">Sí</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
          </Select>
        </div>
        {formData.cartilla_vacunacion === true && <div className="space-y-2">
          <Label htmlFor="esquema-vacunacion">¿Esquema completo?</Label>
          <Select value={formData.esquema_vacunacion_completo == null ? '' : String(formData.esquema_vacunacion_completo)} onValueChange={(value) => setFormData((current) => ({ ...current, esquema_vacunacion_completo: value === 'true' }))}>
            <SelectTrigger id="esquema-vacunacion"><SelectValue placeholder="Sin registrar" /></SelectTrigger>
            <SelectContent><SelectItem value="true">Sí</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
          </Select>
        </div>}
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