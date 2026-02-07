// RF06: Lista de Odontogramas (CON GESTIÓN: BORRAR, RENOMBRAR, MIXTO)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; 
import { useApp, Odontogram } from '@/state/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { collection, query, onSnapshot, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Eye, Trash2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Odontograma
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Odontograma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adulto">Adulto</SelectItem>
                  <SelectItem value="niño">Niño</SelectItem>
                  <SelectItem value="mixto">Mixto (Nuevo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label>Nombre (Opcional)</Label>
                <Input placeholder="Ej. Revisión Mensual" value={customName} onChange={(e) => setCustomName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateNew} disabled={isSaving}>{isSaving ? "Creando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Odontogramas Guardados</h3>
          {listLoading ? (
            <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : odontogramList.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No hay odontogramas guardados.</p>
          ) : (
            <div className="space-y-3">
              {odontogramList.map((odonto) => (
                <div key={odonto.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                        <p className="font-semibold">{odonto.nombre || `Odontograma ${odonto.tipo}`}</p>
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded capitalize">{odonto.tipo}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDate(odonto.fecha)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/pacientes/${patientId}/odontograma/${odonto.id}`}>
                      <Button variant="outline" size="default" title="Ver/Editar"><Eye className="h-4 w-4" />ABRIR</Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => setRenameData({ id: odonto.id, name: odonto.nombre || '' })} title="Renombrar">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(odonto.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas y Modales de Edición */}
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
              <DialogHeader><DialogTitle>Renombrar Odontograma</DialogTitle></DialogHeader>
              <div className="py-4">
                  <Label>Nuevo Nombre</Label>
                  <Input value={renameData?.name || ''} onChange={(e) => setRenameData(prev => prev ? ({...prev, name: e.target.value}) : null)} />
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