// RF07: Odontogram Editor (CON TEXTO LIBRE PERSONALIZADO)
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, Odontogram, ToothState } from '@/state/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ArrowLeft, Save, Loader2, Eraser, Circle, X, Check, ArrowUp, AlertTriangle, 
  FileText, Ban, Activity, Crown, Syringe, AlertCircle, HelpCircle, MinusCircle, 
  SearchX, Edit3
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// --- CONFIGURACIÓN DE HERRAMIENTAS ---
const AFECCIONES = [
  // 1. ESTADOS BÁSICOS
  { id: 'sano', label: 'Sano', icon: Check, color: 'bg-green-500', fill: 'fill-green-100', stroke: 'stroke-green-600', text: 'Sano', priority: 0 },
  { id: 'no_registrado', label: 'No registrado', icon: HelpCircle, color: 'bg-slate-300', fill: 'fill-slate-200', stroke: 'stroke-slate-400', text: 'No registrado', priority: 1 },

  // 2. PATOLOGÍA CARIOSA
  { id: 'caries', label: 'Caries', icon: Circle, color: 'bg-red-500', fill: 'fill-red-500', stroke: 'stroke-red-700', text: 'Caries', priority: 10 },
  { id: 'obturado_s_caries', label: 'Obturado s/caries', icon: Circle, color: 'bg-blue-500', fill: 'fill-blue-500', stroke: 'stroke-blue-700', text: 'Obturado (Bien)', priority: 5 },
  { id: 'obturado_c_caries', label: 'Obturado c/caries', icon: AlertCircle, color: 'bg-orange-500', fill: 'fill-orange-400', stroke: 'stroke-red-600', text: 'Obturado (Mal)', priority: 9 },
  
  // 3. AUSENCIAS Y ERUPCIÓN
  { id: 'perdido_caries', label: 'Perdido (caries)', icon: X, color: 'bg-black', fill: 'fill-black', stroke: 'stroke-black', text: 'Perdido por Caries', priority: 20 },
  { id: 'perdido_otro', label: 'Perdido (otro)', icon: X, color: 'bg-slate-600', fill: 'fill-slate-600', stroke: 'stroke-slate-800', text: 'Perdido (Otra causa)', priority: 19 },
  { id: 'sin_erupcionar', label: 'Sin erupcionar', icon: ArrowUp, color: 'bg-blue-300', fill: 'fill-white', stroke: 'stroke-blue-400', text: 'Sin Erupcionar', priority: 6 },
  
  // 4. RESTAURACIONES Y ENDODONCIA
  { id: 'fisura_obturada', label: 'Fisura obturada', icon: MinusCircle, color: 'bg-blue-200', fill: 'fill-blue-100', stroke: 'stroke-blue-300', text: 'Sellador', priority: 4 },
  { id: 'soporte_puente', label: 'Soporte puente/corona', icon: Crown, color: 'bg-yellow-500', fill: 'fill-yellow-300', stroke: 'stroke-yellow-600', text: 'Corona/Puente', priority: 7 },
  { id: 'trat_conductos', label: 'Trat. Conductos', icon: Syringe, color: 'bg-purple-500', fill: 'fill-purple-300', stroke: 'stroke-purple-600', text: 'Endodoncia', priority: 8 },
  { id: 'inst_separado', label: 'Inst. separado', icon: Ban, color: 'bg-slate-500', fill: 'fill-slate-400', stroke: 'stroke-red-500', text: 'Instrumento Separado', priority: 8 },
  { id: 'lesion_endoperio', label: 'Lesión endoperio', icon: Activity, color: 'bg-pink-600', fill: 'fill-pink-300', stroke: 'stroke-pink-700', text: 'Lesión Endo-Perio', priority: 9 },

  // 5. PERIODONTAL Y OTROS
  { id: 'bolsa_periodontal', label: 'Bolsa periodontal', icon: Activity, color: 'bg-red-300', fill: 'fill-red-100', stroke: 'stroke-red-400', text: 'Bolsa Periodontal', priority: 6 },
  { id: 'recesion_gingival', label: 'Recesión gingival', icon: Activity, color: 'bg-pink-400', fill: 'fill-pink-200', stroke: 'stroke-pink-500', text: 'Recesión Gingival', priority: 6 },
  { id: 'fluorosis', label: 'Fluorosis', icon: SearchX, color: 'bg-yellow-100', fill: 'fill-yellow-50', stroke: 'stroke-yellow-200', text: 'Fluorosis', priority: 3 },
  { id: 'alteracion_forma', label: 'Alteración forma/tam', icon: AlertTriangle, color: 'bg-amber-700', fill: 'fill-amber-600', stroke: 'stroke-amber-800', text: 'Alt. Forma/Tamaño', priority: 5 },
  { id: 'traumatismo', label: 'Traumatismo', icon: AlertTriangle, color: 'bg-rose-500', fill: 'fill-rose-300', stroke: 'stroke-rose-600', text: 'Traumatismo', priority: 9 },
  
  // OPCIÓN PERSONALIZABLE
  { id: 'otro', label: 'Otro / Libre', icon: Edit3, color: 'bg-cyan-500', fill: 'fill-cyan-100', stroke: 'stroke-cyan-500', text: 'Otro', priority: 2 },
  
  // HERRAMIENTA DE BORRADO
  { id: 'borrar', label: 'Borrador', icon: Eraser, color: 'bg-slate-200', fill: '', stroke: '', text: 'Borrar', priority: -1 },
];

// --- COMPONENTE VISUAL DIENTE ---
interface ToothProps {
  number: number;
  data?: ToothState;
  onClick: () => void;
  selectedTool: string;
}

const ToothSVG: React.FC<ToothProps> = ({ number, data, onClick }) => {
  const estados = data?.estados || [];
  
  // Buscar la afección dominante
  const activeConditions = AFECCIONES.filter(af => estados.includes(af.id));
  const dominantCondition = activeConditions.sort((a, b) => b.priority - a.priority)[0];

  const mainColor = dominantCondition ? dominantCondition.fill : 'fill-white';
  const strokeColor = dominantCondition ? dominantCondition.stroke : 'stroke-slate-300';
  
  const isPerdido = estados.some(e => e.includes('perdido'));
  const isSinErupcionar = estados.includes('sin_erupcionar');
  const isEndo = estados.includes('trat_conductos');
  const isOtro = estados.includes('otro');

  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer group relative" onClick={onClick}>
      <span className={cn("text-[10px] sm:text-xs font-bold", estados.length > 0 ? "text-primary" : "text-slate-400")}>
        {number}
      </span>
      <div className="relative h-8 w-6 sm:h-10 sm:w-8 transition-transform group-hover:scale-110">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
          <path 
            d="M20,30 Q20,5 50,5 Q80,5 80,30 L80,70 Q80,95 50,95 Q20,95 20,70 Z" 
            className={cn("stroke-[3px] transition-colors duration-200", mainColor, strokeColor)} 
          />
          {!isPerdido && !isSinErupcionar && (
             <circle cx="50" cy="50" r="15" className="fill-transparent stroke-slate-300 stroke-1 opacity-50" />
          )}
          {isPerdido && <path d="M20,20 L80,80 M80,20 L20,80" className="stroke-white stroke-[4px] opacity-80" />}
          {isEndo && !isPerdido && <path d="M50,50 L50,90" className="stroke-slate-700 stroke-[3px]" />}
        </svg>
        
        {/* Indicadores */}
        {estados.length > 1 && !isPerdido && (
            <div className="absolute -top-1 -right-1 h-2 w-2 sm:h-3 sm:w-3 bg-orange-500 rounded-full border border-white z-10" title="Múltiples hallazgos" />
        )}
        {/* Indicador específico para 'Otro' (Punto Cyan) */}
        {isOtro && !isPerdido && (
            <div className="absolute -bottom-1 -right-1 h-2 w-2 sm:h-3 sm:w-3 bg-cyan-500 rounded-full border border-white z-10" title={data?.textoLibre || "Nota personalizada"} />
        )}
        
        {isSinErupcionar && (
          <ArrowUp className="h-5 w-5 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none drop-shadow-md" />
        )}
      </div>
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---
const OdontogramEditorPage: React.FC = () => {
  const { patientId, odontogramId } = useParams<{ patientId: string; odontogramId: string }>();
  const navigate = useNavigate();
  const { patients } = useApp();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [odontogram, setOdontogram] = useState<Odontogram | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>('caries');
  const [notas, setNotas] = useState('');

  // Estados para el Modal de Texto Libre
  const [isFreeTextModalOpen, setIsFreeTextModalOpen] = useState(false);
  const [currentToothForFreeText, setCurrentToothForFreeText] = useState<number | null>(null);
  const [freeTextValue, setFreeTextValue] = useState("");

  useEffect(() => {
    const fetchOdonto = async () => {
      if (!patientId || !odontogramId) { setLoading(false); return; }
      try {
        const docRef = doc(db, 'pacientes', patientId, 'odontograma', odontogramId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as Odontogram;
          setOdontogram({ ...data, id: snap.id });
          setNotas(data.notas || '');
        } else {
          toast.error("El odontograma no existe");
          navigate(-1);
        }
      } catch (error) {
        console.error(error);
        toast.error("Error al cargar");
      } finally {
        setLoading(false);
      }
    };
    fetchOdonto();
  }, [patientId, odontogramId, navigate]);

  const handleSave = async () => {
    if (!patientId || !odontogramId || !odontogram) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'pacientes', patientId, 'odontograma', odontogramId);
      await updateDoc(docRef, { dientes: odontogram.dientes, notas: notas });
      toast.success("Guardado correctamente");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToothClick = (toothNumber: number) => {
    if (!odontogram) return;
    const toothKey = toothNumber.toString();
    const currentToothState = odontogram.dientes[toothKey] || { estados: [], superficies: {} };
    let newEstados = [...currentToothState.estados];
    let newTextoLibre = currentToothState.textoLibre;

    if (selectedTool === 'borrar') {
      newEstados = []; 
      newTextoLibre = ""; // Borrar también el texto
    } else if (selectedTool === 'sano') {
      newEstados = ['sano'];
      newTextoLibre = "";
    } else if (selectedTool === 'otro') {
        // CASO ESPECIAL: TEXTO LIBRE
        // Si ya tiene 'otro', lo quitamos. Si no, abrimos modal.
        if (newEstados.includes('otro')) {
            newEstados = newEstados.filter(e => e !== 'otro');
            newTextoLibre = "";
            // Actualizamos directo
            setOdontogram({
                ...odontogram,
                dientes: { ...odontogram.dientes, [toothKey]: { ...currentToothState, estados: newEstados, textoLibre: newTextoLibre } }
            });
            return;
        } else {
            // Abrir Modal para escribir
            setCurrentToothForFreeText(toothNumber);
            setFreeTextValue(newTextoLibre || "");
            setIsFreeTextModalOpen(true);
            return; // Detenemos aquí, el guardado se hace en saveFreeText
        }
    } else {
      // Herramientas normales
      newEstados = newEstados.filter(e => e !== 'sano');
      if (newEstados.includes(selectedTool)) {
        newEstados = newEstados.filter(e => e !== selectedTool);
      } else {
        newEstados.push(selectedTool);
      }
    }

    setOdontogram({
      ...odontogram,
      dientes: { ...odontogram.dientes, [toothKey]: { ...currentToothState, estados: newEstados, textoLibre: newTextoLibre } }
    });
  };

  // Función para guardar lo que se escribió en el modal
  const saveFreeText = () => {
      if (!odontogram || currentToothForFreeText === null) return;
      const toothKey = currentToothForFreeText.toString();
      const currentToothState = odontogram.dientes[toothKey] || { estados: [], superficies: {} };
      let newEstados = [...currentToothState.estados];
      
      // Agregamos 'otro' si no está
      if (!newEstados.includes('otro')) {
          newEstados = newEstados.filter(e => e !== 'sano');
          newEstados.push('otro');
      }

      setOdontogram({
        ...odontogram,
        dientes: { 
            ...odontogram.dientes, 
            [toothKey]: { 
                ...currentToothState, 
                estados: newEstados,
                textoLibre: freeTextValue // Guardamos el texto personalizado
            } 
        }
      });
      
      setIsFreeTextModalOpen(false);
      setFreeTextValue("");
      setCurrentToothForFreeText(null);
  };

  // Generar Lista de Hallazgos
  const findingsList = useMemo(() => {
    if (!odontogram) return [];
    return Object.entries(odontogram.dientes)
      .filter(([_, data]) => data.estados.length > 0 && !data.estados.includes('sano'))
      .map(([key, data]) => {
         // Si tiene 'otro', usamos el textoLibre como etiqueta
         const labels = data.estados.map(id => {
             if (id === 'otro' && data.textoLibre) return `Nota: ${data.textoLibre}`;
             return AFECCIONES.find(a => a.id === id)?.text || id;
         }).join(', ');
         return { number: key, text: labels };
      })
      .sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [odontogram]);

  const renderRow = (start: number, end: number, reverse = false) => {
    const teeth = [];
    if (reverse) { for (let i = start; i >= end; i--) teeth.push(i); } 
    else { for (let i = start; i <= end; i++) teeth.push(i); }

    return (
      <div className="flex gap-1 sm:gap-2 justify-center bg-white p-2 rounded-lg shadow-sm border border-slate-100">
        {teeth.map(t => (
          <ToothSVG key={t} number={t} data={odontogram?.dientes[t.toString()]} onClick={() => handleToothClick(t)} selectedTool={selectedTool} />
        ))}
      </div>
    );
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!odontogram) return <div className="p-8 text-center">No se pudo cargar el odontograma.</div>;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col space-y-4 p-2 sm:p-4 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-card p-3 rounded-lg border shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" /> Volver</Button>
          <div className="h-8 w-[1px] bg-border mx-2 hidden sm:block"></div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Odontograma {odontogram.tipo === 'mixto' ? 'Mixto' : 'Permanente'}
            </h2>
            <p className="text-xs text-muted-foreground hidden sm:block">
               {patients.find(p => p.id === patientId)?.nombres} {patients.find(p => p.id === patientId)?.apellidos}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className={cn(saving && "opacity-80")}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-4 overflow-hidden">
        
        {/* HERRAMIENTAS */}
        <Card className="w-full lg:w-60 shrink-0 flex flex-col max-h-[250px] lg:max-h-full">
          <CardHeader className="p-3 pb-2 border-b">
            <CardTitle className="text-xs uppercase text-muted-foreground font-bold">Diagnósticos</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto bg-slate-50/50">
            <div className="p-2 space-y-1">
              {AFECCIONES.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-all border w-full text-left",
                    selectedTool === tool.id 
                      ? "bg-white border-primary ring-1 ring-primary shadow-sm font-medium text-slate-900" 
                      : "hover:bg-slate-100 border-transparent text-slate-600"
                  )}
                >
                  <div className={cn("h-3 w-3 rounded-full flex items-center justify-center shrink-0", tool.color)}></div>
                  <span className="truncate">{tool.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CANVAS */}
        <div className="flex-1 bg-white rounded-xl border p-2 sm:p-4 overflow-y-auto flex items-start justify-center min-h-[300px]">
          <div className="space-y-6 sm:space-y-8 w-full max-w-4xl origin-top scale-[0.80] sm:scale-100 pt-4">
            
            {odontogram.tipo === 'mixto' && (
              <div className="space-y-6">
                 <div className="flex justify-center">
                    <Badge variant="outline" className="bg-slate-50">
                      Externo: Adulto | Interno: Niño
                    </Badge>
                 </div>
                 
                 {/* Superior */}
                 <div className="flex flex-wrap gap-4 sm:gap-10 justify-center items-end">
                    <div className="flex flex-col items-end gap-2">
                        {renderRow(18, 11, true)}
                        <div className="pr-4 scale-90 origin-right">{renderRow(55, 51, true)}</div>
                    </div>
                    <div className="flex flex-col items-start gap-2">
                        {renderRow(21, 28, false)}
                        <div className="pl-4 scale-90 origin-left">{renderRow(61, 65, false)}</div>
                    </div>
                 </div>
                 <Separator className="my-4" />
                 {/* Inferior */}
                 <div className="flex flex-wrap gap-4 sm:gap-10 justify-center items-start">
                    <div className="flex flex-col items-end gap-2">
                        <div className="pr-4 scale-90 origin-right">{renderRow(85, 81, true)}</div>
                        {renderRow(48, 41, true)}
                    </div>
                    <div className="flex flex-col items-start gap-2">
                        <div className="pl-4 scale-90 origin-left">{renderRow(71, 75, false)}</div>
                        {renderRow(31, 38, false)}
                    </div>
                 </div>
              </div>
            )}

            {(odontogram.tipo === 'adulto' || odontogram.tipo === 'niño') && (
              <div className="space-y-8">
                <div className="flex flex-wrap gap-4 justify-center">
                   {odontogram.tipo === 'adulto' ? renderRow(18, 11, true) : renderRow(55, 51, true)}
                   {odontogram.tipo === 'adulto' ? renderRow(21, 28, false) : renderRow(61, 65, false)}
                </div>
                <Separator />
                <div className="flex flex-wrap gap-4 justify-center">
                   {odontogram.tipo === 'adulto' ? renderRow(48, 41, true) : renderRow(85, 81, true)}
                   {odontogram.tipo === 'adulto' ? renderRow(31, 38, false) : renderRow(71, 75, false)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RESUMEN */}
        <Card className="w-full lg:w-72 shrink-0 flex flex-col h-[250px] lg:h-full">
          <CardHeader className="p-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Resumen de Hallazgos
            </CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 p-0">
               {findingsList.length === 0 ? (
                 <div className="p-8 text-center text-sm text-muted-foreground">
                   <p>Selecciona diagnósticos para verlos aquí.</p>
                 </div>
               ) : (
                 <div className="divide-y">
                   {findingsList.map((item) => (
                     <div key={item.number} className="p-3 hover:bg-slate-50 flex gap-3 text-sm">
                       <div className="font-bold text-primary bg-primary/10 h-6 w-8 rounded flex items-center justify-center shrink-0 border border-primary/20">
                         {item.number}
                       </div>
                       <div>
                         <p className="font-medium text-slate-800 text-xs sm:text-sm leading-tight whitespace-pre-wrap">{item.text}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </ScrollArea>
            
            <div className="p-3 border-t bg-background">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notas Generales</label>
              <Textarea 
                placeholder="Observaciones generales..." 
                className="min-h-[80px] text-xs resize-none"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* MODAL PARA TEXTO LIBRE */}
      <Dialog open={isFreeTextModalOpen} onOpenChange={setIsFreeTextModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Nota Personalizada - Diente {currentToothForFreeText}</DialogTitle>
                <DialogDescription>
                    Escribe los detalles específicos de la afección para este diente.
                </DialogDescription>
            </DialogHeader>
            <div className="py-2">
                <Label>Descripción</Label>
                <Input 
                    value={freeTextValue} 
                    onChange={(e) => setFreeTextValue(e.target.value)}
                    placeholder="Ej. Mancha blanca, fractura vertical..."
                    autoFocus
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsFreeTextModalOpen(false)}>Cancelar</Button>
                <Button onClick={saveFreeText}>Guardar Nota</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OdontogramEditorPage;