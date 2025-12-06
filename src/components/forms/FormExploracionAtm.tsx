import React from 'react';
import { IExploracionAtm } from '@/state/AppContext';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

interface Props {
  formData: IExploracionAtm;
  setFormData: (updater: React.SetStateAction<IExploracionAtm>) => void;
}

const FormExploracionAtm: React.FC<Props> = ({ formData, setFormData }) => {
  const handleCheckboxChange = (id: keyof IExploracionAtm, checked: boolean) => {
    setFormData(prev => ({ ...prev, [id]: checked }));
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="apertura_mm">Apertura (mm)</Label>
          <Input id="apertura_mm" value={formData.apertura_mm} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lateralidad">Lateralidad</Label>
          <Input id="lateralidad" value={formData.lateralidad} onChange={handleChange} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="ruidos" checked={formData.ruidos} onCheckedChange={(v) => handleCheckboxChange('ruidos', !!v)} />
          <Label htmlFor="ruidos">Ruidos</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="chasquidos" checked={formData.chasquidos} onCheckedChange={(v) => handleCheckboxChange('chasquidos', !!v)} />
          <Label htmlFor="chasquidos">Chasquidos</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="crepitacion" checked={formData.crepitacion} onCheckedChange={(v) => handleCheckboxChange('crepitacion', !!v)} />
          <Label htmlFor="crepitacion">Crepitación</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="dificultad_abrir_boca" checked={formData.dificultad_abrir_boca} onCheckedChange={(v) => handleCheckboxChange('dificultad_abrir_boca', !!v)} />
          <Label htmlFor="dificultad_abrir_boca">Dificultad al abrir</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="dolor_mov_lateralidad" checked={formData.dolor_mov_lateralidad} onCheckedChange={(v) => handleCheckboxChange('dolor_mov_lateralidad', !!v)} />
          <Label htmlFor="dolor_mov_lateralidad">Dolor en lateralidad</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="fatiga_dolor_muscular" checked={formData.fatiga_dolor_muscular} onCheckedChange={(v) => handleCheckboxChange('fatiga_dolor_muscular', !!v)} />
          <Label htmlFor="fatiga_dolor_muscular">Fatiga/Dolor muscular</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="disminucion_apertura" checked={formData.disminucion_apertura} onCheckedChange={(v) => handleCheckboxChange('disminucion_apertura', !!v)} />
          <Label htmlFor="disminucion_apertura">Disminución de apertura</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="desviacion_apertura_cierre" checked={formData.desviacion_apertura_cierre} onCheckedChange={(v) => handleCheckboxChange('desviacion_apertura_cierre', !!v)} />
          <Label htmlFor="desviacion_apertura_cierre">Desviación apertura/cierre</Label>
        </div>
      </div>
    </div>
  );
};

export default FormExploracionAtm;