// (ODONTOGRAMA CON HEADER DE PACIENTE)
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Odontogram, ToothState, useApp } from '@/state/AppContext'; // Importamos useApp
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatDate, calculateAge } from '@/lib/utils'; // Importamos calculateAge
import { toast } from 'sonner';
// Importaciones de Firebase
import { doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
// Importaciones de UI
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Save, Info, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

// --- Definiciones de Dientes ---
const ADULTO_Q1 = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULTO_Q2 = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULTO_Q3 = [31, 32, 33, 34, 35, 36, 37, 38];
const ADULTO_Q4 = [48, 47, 46, 45, 44, 43, 42, 41];

const NINO_Q5 = [55, 54, 53, 52, 51];
const NINO_Q6 = [61, 62, 63, 64, 65];
const NINO_Q7 = [71, 72, 73, 74, 75];
const NINO_Q8 = [85, 84, 83, 82, 81];

// --- Definiciones de Afecciones ---
export const AFECCIONES_LISTA = [
  { code: '0', label: 'Sano', color: 'bg-green-100 text-green-800 border-green-200' },
  { code: '1', label: 'Caries', color: 'bg-red-100 text-red-800 border-red-200' },
  { code: '2', label: 'Obturado c/caries', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { code: '3', label: 'Obturado s/caries', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { code: '4', label: 'Perdido (caries)', color: 'bg-gray-800 text-white border-gray-900' },
  { code: '5', label: 'Perdido (otro)', color: 'bg-gray-500 text-white border-gray-600' },
  { code: '6', label: 'Fisura obturada', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { code: '7', label: 'Soporte puente/corona', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { code: '8', label: 'Sin erupcionar', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  { code: 'T', label: 'Traumatismo', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { code: '9', label: 'No registrado', color: 'bg-zinc-100 text-zinc-800 border-zinc-200' },
  { code: '11', label: 'Recesión gingival', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { code: '12', label: 'Trat. Conductos', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { code: '13', label: 'Inst. separado', color: 'bg-red-50 text-red-600 border-red-100' },
  { code: '14', label: 'Bolsa periodontal', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { code: '15', label: 'Fluorosis', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { code: '16', label: 'Alteración forma/tam', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  { code: '17', label: 'Lesión endoperio', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  { code: 'LIBRE', label: 'Otro / Libre', color: 'bg-sky-100 text-sky-800 border-sky-200' },
];

const OdontogramEditorPage: React.FC = () => {
  const { id: patientId, odontogramaId } = useParams<{ id: string; odontogramaId: string }>();
  const navigate = useNavigate();
  
  // 1. Obtenemos los pacientes del contexto
  const { patients } = useApp();

  // 2. Buscamos al paciente actual
  const patient = useMemo(() => patients.find(p => p.id === patientId), [patients, patientId]);

  const [odontogram, setOdontogram] = useState<Odontogram | null>(null);
  const [localDientes, setLocalDientes] = useState<Odontogram['dientes']>({});
  const [localNotas, setLocalNotas] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

  useEffect(() => {
    if (!patientId || !odontogramaId) {
      toast.error("Faltan datos para cargar el odontograma.");
      navigate('/');
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, 'pacientes', patientId, 'odontograma', odontogramaId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const odontoData = {
          id: docSnap.id,
          ...data,
          fecha: (data.fecha as Timestamp)?.toDate ? (data.fecha as Timestamp).toDate().toISOString() : new Date().toISOString(),
        } as Odontogram;
        
        setOdontogram(odontoData);
        setLocalDientes(odontoData.dientes || {});
        setLocalNotas(odontoData.notas || '');
      } else {
        toast.error("No se pudo encontrar el odontograma.");
        navigate(`/pacientes/${patientId}`);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [patientId, odontogramaId, navigate]);

  const getToothState = (toothNumber: number): ToothState => {
    return localDientes[toothNumber] || { estados: ['0'], superficies: {} };
  };

  const handleAfeccionChange = (afeccionCode: string, isChecked: boolean) => {
    if (selectedTooth === null) return;

    const currentState = getToothState(selectedTooth);
    let newEstados = [...currentState.estados];

    if (isChecked) {
      if (afeccionCode === '0') {
        newEstados = ['0'];
      } else {
        newEstados = newEstados.filter(s => s !== '0');
        if (!newEstados.includes(afeccionCode)) newEstados.push(afeccionCode);
      }
    } else {
      newEstados = newEstados.filter(s => s !== afeccionCode);
      if (newEstados.length === 0) newEstados = ['0'];
    }

    setLocalDientes(prev => ({
      ...prev,
      [selectedTooth]: {
        ...currentState,
        estados: newEstados,
      }
    }));
  };

  const handleTextoLibreChange = (text: string) => {
    if (selectedTooth === null) return;
    setLocalDientes(prev => ({
        ...prev,
        [selectedTooth]: {
            ...prev[selectedTooth],
            textoLibre: text
        }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!patientId || !odontogramaId) throw new Error("IDs no encontrados");
      const docRef = doc(db, 'pacientes', patientId, 'odontograma', odontogramaId);
      await updateDoc(docRef, {
        dientes: localDientes,
        notas: localNotas,
      });
      toast.success("Odontograma actualizado");
      navigate(`/pacientes/${patientId}`);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  };

  // Componente Diente
  const Tooth: React.FC<{ number: number }> = ({ number }) => {
    const state = getToothState(number);
    const isSelected = selectedTooth === number;
    const isSano = state.estados.length === 1 && state.estados[0] === '0';

    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setSelectedTooth(number)}
        className={cn(
          "relative flex flex-col items-center p-1 cursor-pointer transition-all duration-200",
          "w-16 h-24 sm:w-20 sm:h-28",
          "border-2 rounded-xl bg-card shadow-sm",
          isSelected ? "border-primary ring-2 ring-primary/20 z-10 scale-105" : "border-border hover:border-primary/50",
          isSano && !isSelected ? "opacity-80" : "opacity-100"
        )}
      >
        <span className="text-xs font-bold text-muted-foreground mb-1 bg-muted/50 w-full text-center rounded-t-lg py-0.5">
            {number}
        </span>

        <div className="flex-1 w-full flex flex-col gap-1 items-center justify-center overflow-hidden px-1">
            {isSano ? (
                <div className="h-full w-full bg-green-50/50 rounded flex items-center justify-center">
                   <span className="text-green-300 text-xs">Sano</span>
                </div>
            ) : (
                <div className="flex flex-wrap justify-center content-center gap-1 w-full h-full">
                    {state.estados.map(code => {
                        const afeccion = AFECCIONES_LISTA.find(a => a.code === code);
                        if (!afeccion) return null;
                        
                        let labelToShow = afeccion.label;
                        if (code === 'LIBRE' && state.textoLibre) {
                            labelToShow = state.textoLibre;
                        } else if (code === 'LIBRE') {
                            labelToShow = '...';
                        }

                        return (
                            <div 
                                key={code} 
                                className={cn(
                                    "text-[9px] font-bold px-1 rounded border shadow-sm w-full text-center truncate",
                                    afeccion.color
                                )}
                                title={code === 'LIBRE' ? state.textoLibre || afeccion.label : afeccion.label}
                            >
                                {labelToShow.substring(0, 8) + (labelToShow.length > 8 ? '.' : '')}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
      </motion.div>
    );
  };

  const OdontogramGrid: React.FC<{ tipo: 'adulto' | 'niño' }> = ({ tipo }) => {
    const isAdulto = tipo === 'adulto';
    const Q1 = isAdulto ? ADULTO_Q1 : NINO_Q5;
    const Q2 = isAdulto ? ADULTO_Q2 : NINO_Q6;
    const Q3 = isAdulto ? ADULTO_Q3 : NINO_Q7;
    const Q4 = isAdulto ? ADULTO_Q4 : NINO_Q8;

    return (
      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-max px-4 flex flex-col gap-8 items-center mx-auto">
            {/* Maxilar Superior */}
            <div className="flex gap-4 sm:gap-8 relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2"></div>
                <div className="flex gap-1 sm:gap-2">
                    {Q1.map(t => <Tooth key={t} number={t} />)}
                </div>
                <div className="flex gap-1 sm:gap-2">
                    {Q2.map(t => <Tooth key={t} number={t} />)}
                </div>
            </div>

            {/* Maxilar Inferior */}
            <div className="flex gap-4 sm:gap-8 relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2"></div>
                <div className="flex gap-1 sm:gap-2">
                    {Q4.map(t => <Tooth key={t} number={t} />)}
                </div>
                <div className="flex gap-1 sm:gap-2">
                    {Q3.map(t => <Tooth key={t} number={t} />)}
                </div>
            </div>
        </div>
      </div>
    );
  };

  const selectedToothState = useMemo(() => {
    if (selectedTooth === null) return null;
    return getToothState(selectedTooth);
  }, [selectedTooth, localDientes]);

  if (isLoading || !odontogram) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6"
    >
      {/* HEADER MEJORADO */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/pacientes/${patientId}`)}>
            <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                {/* 3. Mostramos el nombre del paciente si existe, sino un fallback */}
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    {patient ? `${patient.nombres} ${patient.apellidos}` : 'Paciente Desconocido'}
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                    {patient && <span>{calculateAge(patient.fechaNacimiento)} años •</span>}
                    <Badge variant="outline" className="capitalize">{odontogram?.tipo}</Badge>
                    <span>• {formatDate(odontogram?.fecha || '')}</span>
                </p>
            </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* COLUMNA IZQ: Gráfico */}
        <div className="xl:col-span-2 order-2 xl:order-1">
          <Card className="border-2">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Mapa Dental</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 bg-secondary/5 rounded-b-lg">
              <OdontogramGrid tipo={odontogram?.tipo || 'adulto'} />
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                 <Info className="h-4 w-4" />
                 <span>Haz clic en un diente para editar sus afecciones.</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DER: Panel de Control */}
        <div className="xl:col-span-1 order-1 xl:order-2 space-y-6 sticky top-4">
          
          <Card className={cn("border-2 transition-colors", selectedTooth ? "border-primary" : "border-border")}>
            <CardHeader className="bg-muted/30 py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                    {selectedTooth ? `Diente ${selectedTooth}` : "Selecciona un diente"}
                </span>
                {selectedTooth && <Badge>Editando</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {selectedTooth === null ? (
                <div className="py-12 px-6 text-center text-muted-foreground flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <ArrowLeft className="h-6 w-6 text-muted-foreground opacity-50" />
                    </div>
                    <p>Selecciona un diente del mapa para ver y modificar sus condiciones.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="grid gap-1 p-2">
                    {AFECCIONES_LISTA.map((afeccion) => {
                        const isSelected = selectedToothState?.estados.includes(afeccion.code);
                        return (
                            <div key={afeccion.code}>
                                <label
                                    className={cn(
                                        "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border",
                                        isSelected 
                                            ? "bg-primary/10 border-primary/50 shadow-sm" 
                                            : "hover:bg-muted border-transparent"
                                    )}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => handleAfeccionChange(afeccion.code, !!checked)}
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium text-sm">{afeccion.label}</span>
                                    </div>
                                    <div className={cn("w-3 h-3 rounded-full border", afeccion.color.split(' ')[0].replace('bg-', 'bg-'))} />
                                </label>
                                
                                {afeccion.code === 'LIBRE' && isSelected && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="pl-8 pr-2 pt-2 pb-4"
                                    >
                                        <Label htmlFor="textoLibre" className="text-xs text-muted-foreground mb-1.5 block">
                                            Describe la condición:
                                        </Label>
                                        <Textarea
                                            id="textoLibre"
                                            placeholder="Ej. Restauración de resina..."
                                            className="min-h-[60px] text-sm"
                                            value={selectedToothState?.textoLibre || ''}
                                            onChange={(e) => handleTextoLibreChange(e.target.value)}
                                        />
                                    </motion.div>
                                )}
                            </div>
                        );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Notas Generales</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea
                placeholder="Escribe aquí observaciones generales sobre el tratamiento..."
                rows={6}
                value={localNotas}
                onChange={(e) => setLocalNotas(e.target.value)}
                disabled={isSaving}
                className="resize-none bg-muted/30"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default OdontogramEditorPage;