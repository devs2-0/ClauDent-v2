// RF06: Lista de Odontogramas (DISEÑO LIMPIO + RESPONSIVE)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; 
import { useApp, Odontogram } from '@/state/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Eye, Trash2, Pencil, Calendar, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface PatientOdontogramProps {
  patientId: string;
}

const PatientOdontogram: React.FC<PatientOdontogramProps> = ({ patientId }) => {
  const { addOdontogram, deleteOdontogram, updateOdontogramName } = useApp();
  
  const [odontogramList, setOdontogramList] = useState<Odontogram[]>([]);
  const [listLoading, setListLoading] = useState(true);
  
  // Estados Modales
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<'adulto' | 'niño' | 'mixto'>('adulto');
  const [customName, setCustomName] = useState('');

  // Estados Eliminar/Renombrar
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameData, setRenameData] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (!patientId) return;
    setListLoading(true);
    const q = query(collection(db, 'pacientes', patientId, 'odontograma'), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Odontogram[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate ? doc.data().fecha.toDate().toISOString() : new Date().toISOString(),
      } as Odontogram));
      setOdontogramList(list);
      setListLoading(false);
    });
    return () => unsubscribe();
  }, [patientId]);

  const handleCreateNew = async () => {
    setIsSaving(true);
    try {
      await addOdontogram(patientId, selectedType, customName || undefined);
      toast.success(`Odontograma creado`);
      setIsNewModalOpen(false);
      setSelectedType('adulto');
      setCustomName('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
        await deleteOdontogram(patientId, deleteId);
        setDeleteId(null);
    }
  };

  const handleConfirmRename = async () => {
      if (renameData) {
          await updateOdontogramName(patientId, renameData.id, renameData.name);
          setRenameData(null);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Historial de Odontogramas</h3>
        <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
            <DialogTrigger asChild>
            <Button>
                <Plus className="h-4 w-4 mr-2" /> Nuevo
            </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>Crear Nuevo Odontograma</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                <Label>Tipo de Dentición</Label>
                <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="adulto">Permanente (Adulto)</SelectItem>
                    <SelectItem value="niño">Temporal (Niño)</SelectItem>
                    <SelectItem value="mixto">Mixta (6 - 12 años)</SelectItem>
                    </SelectContent>
                </Select>
                </div>
                <div className="space-y-2">
                    <Label>Nombre / Descripción (Opcional)</Label>
                    <Input placeholder="Ej. Revisión Inicial..." value={customName} onChange={(e) => setCustomName(e.target.value)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateNew} disabled={isSaving}>{isSaving ? "Creando..." : "Crear"}</Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
      
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          {listLoading ? (
            <div className="space-y-3"><Skeleton className="h-24 w-full rounded-lg" /><Skeleton className="h-24 w-full rounded-lg" /></div>
          ) : odontogramList.length === 0 ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground bg-muted/30">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No hay odontogramas registrados.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {odontogramList.map((odonto) => (
                <div key={odonto.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-card border rounded-xl hover:shadow-sm transition-all gap-4">
                  
                  {/* SECCIÓN INFORMACIÓN */}
                  <div className="flex gap-4 items-start w-full sm:w-auto">
                    {/* Textos */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <h4 className="font-semibold text-base leading-tight break-words">
                                {odonto.nombre || `Odontograma ${odonto.tipo}`}
                            </h4>
                            <Badge variant="outline" className="w-fit capitalize text-[10px] font-normal text-muted-foreground">
                                {odonto.tipo}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(odonto.fecha)}
                        </div>
                    </div>
                  </div>

                  {/* SECCIÓN ACCIONES */}
                  <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <Link to={`/pacientes/${patientId}/odontograma/${odonto.id}`} className="flex-1 sm:flex-none">
                      {/* Botón Estándar (Outline) - Sin colores fuertes */}
                      <Button variant="outline" className="w-full sm:w-auto">
                        <Eye className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                    </Link>
                    
                    <div className="flex gap-1 border-l pl-2 ml-2">
                        <Button variant="ghost" size="icon" onClick={() => setRenameData({ id: odonto.id, name: odonto.nombre || '' })} title="Cambiar nombre">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground" onClick={() => setDeleteId(odonto.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas y Modales */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar odontograma?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameData} onOpenChange={(open) => !open && setRenameData(null)}>
          <DialogContent>
              <DialogHeader><DialogTitle>Renombrar</DialogTitle></DialogHeader>
              <div className="py-4">
                  <Label>Nuevo Nombre</Label>
                  <Input 
                    value={renameData?.name || ''} 
                    onChange={(e) => setRenameData(prev => prev ? ({...prev, name: e.target.value}) : null)} 
                    placeholder="Ej. Finalizado"
                    autoFocus
                  />
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setRenameData(null)}>Cancelar</Button>
                  <Button onClick={handleConfirmRename}>Guardar</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientOdontogram;
