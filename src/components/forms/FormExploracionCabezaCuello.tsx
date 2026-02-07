import React from 'react';
import { IExploracionCabezaCuello } from '@/state/AppContext';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  formData: IExploracionCabezaCuello;
  setFormData: (updater: React.SetStateAction<IExploracionCabezaCuello>) => void;
}

const FormExploracionCabezaCuello: React.FC<Props> = ({ formData, setFormData }) => {
  const handleCheckboxChange = (id: keyof IExploracionCabezaCuello, checked: boolean) => {
    setFormData(prev => ({ ...prev, [id]: checked }));
  };
  const handleSelectChange = (id: keyof IExploracionCabezaCuello, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value as any }));
  };

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="cabeza_exostosis" checked={formData.cabeza_exostosis} onCheckedChange={(v) => handleCheckboxChange('cabeza_exostosis', !!v)} />
          <Label htmlFor="cabeza_exostosis">Cabeza: Exostosis</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="cabeza_endostosis" checked={formData.cabeza_endostosis} onCheckedChange={(v) => handleCheckboxChange('cabeza_endostosis', !!v)} />
          <Label htmlFor="cabeza_endostosis">Cabeza: Endostosis</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="cara_asimetria_transversal" checked={formData.cara_asimetria_transversal} onCheckedChange={(v) => handleCheckboxChange('cara_asimetria_transversal', !!v)} />
          <Label htmlFor="cara_asimetria_transversal">Cara: Asimetría Transversal</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="cara_asimetria_longitudinal" checked={formData.cara_asimetria_longitudinal} onCheckedChange={(v) => handleCheckboxChange('cara_asimetria_longitudinal', !!v)} />
          <Label htmlFor="cara_asimetria_longitudinal">Cara: Asimetría Longitudinal</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="cuello_cadena_ganglionar_palpable" checked={formData.cuello_cadena_ganglionar_palpable} onCheckedChange={(v) => handleCheckboxChange('cuello_cadena_ganglionar_palpable', !!v)} />
          <Label htmlFor="cuello_cadena_ganglionar_palpable">Cuello: Cadena Ganglionar Palpable</Label>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="craneo_tipo">Tipo de Cráneo</Label>
          <Select value={formData.craneo_tipo} onValueChange={(v) => handleSelectChange('craneo_tipo', v)}>
            <SelectTrigger id="craneo_tipo"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dolicocefálico">Dolicocefálico</SelectItem>
              <SelectItem value="mesocefálico">Mesocefálico</SelectItem>
              <SelectItem value="braquicefálico">Braquicefálico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="perfil">Perfil</Label>
          <Select value={formData.perfil} onValueChange={(v) => handleSelectChange('perfil', v)}>
            <SelectTrigger id="perfil"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="concavo">Cóncavo</SelectItem>
              <SelectItem value="convexo">Convexo</SelectItem>
              <SelectItem value="recto">Recto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="piel">Piel</Label>
          <Select value={formData.piel} onValueChange={(v) => handleSelectChange('piel', v)}>
            <SelectTrigger id="piel"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="palida">Pálida</SelectItem>
              <SelectItem value="cianotica">Cianótica</SelectItem>
              <SelectItem value="enrojecida">Enrojecida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="musculos">Músculos</Label>
          <Select value={formData.musculos} onValueChange={(v) => handleSelectChange('musculos', v)}>
            <SelectTrigger id="musculos"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hipotonicos">Hipotónicos</SelectItem>
              <SelectItem value="hipertonicos">Hipertónicos</SelectItem>
              <SelectItem value="espasticos">Espásticos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="otros">Otros</Label>
        <Textarea id="otros" value={formData.otros} onChange={(e) => setFormData(prev => ({...prev, otros: e.target.value}))} rows={2} />
      </div>
    </div>
  );
};

export default FormExploracionCabezaCuello;