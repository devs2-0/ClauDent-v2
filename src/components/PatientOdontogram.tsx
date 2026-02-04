// RF06: Lista de Odontogramas (Llama a la PÁGINA de edición)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; 
import { useApp, Odontogram } from '@/state/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
// Importaciones de Firebase
import { collection, query, onSnapshot, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
// Importaciones de UI
import { Plus, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils';
// ¡ELIMINADO! Ya no importamos el editor modal

interface PatientOdontogramProps {
  patientId: string;
}

const PatientOdontogram: React.FC<PatientOdontogramProps> = ({ patientId }) => {
  const { addOdontogram } = useApp();
  
  const [odontogramList, setOdontogramList] = useState<Odontogram[]>([]);
  const [listLoading, setListLoading] = useState(true);
  
  // Estado para el modal "Nuevo"
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<'adulto' | 'niño'>('adulto');


  // Cargar la LISTA de odontogramas
  useEffect(() => {
    if (!patientId) return;

    setListLoading(true);
    const odontogramRef = collection(db, 'pacientes', patientId, 'odontograma');
    const q = query(odontogramRef, orderBy('fecha', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const list: Odontogram[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fecha: data.fecha?.toDate ? data.fecha.toDate().toISOString() : new Date().toISOString(),
        } as Odontogram;
      });
      setOdontogramList(list);
      setListLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);

  // Handler para crear uno nuevo
  const handleCreateNew = async () => {
    setIsSaving(true);
    try {
      await addOdontogram(patientId, selectedType);
      toast.success(`Odontograma (${selectedType}) creado`);
      setIsNewModalOpen(false);
      setSelectedType('adulto');
    } catch (error) {
      console.error(error);
      toast.error('Error al crear el odontograma');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Esqueleto de carga
  const ListLoadingSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* --- Modal para "Nuevo Odontograma" --- */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Odontograma
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Odontograma</DialogTitle>
            <DialogDescription>
              Selecciona el tipo de odontograma que deseas crear.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tipo-odontograma">Tipo de Odontograma</Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
                <SelectTrigger id="tipo-odontograma">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adulto">Adulto (Permanente)</SelectItem>
                  <SelectItem value="niño">Niño (Temporal / Mixto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleCreateNew} disabled={isSaving}>
              {isSaving ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* --- Lista de Odontogramas Existentes --- */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Odontogramas Guardados</h3>
          {listLoading ? (
            <ListLoadingSkeleton />
          ) : odontogramList.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No hay odontogramas guardados para este paciente.
            </p>
          ) : (
            <div className="space-y-3">
              {odontogramList.map((odonto) => (
                <div 
                  key={odonto.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted"
                >
                  <div>
                    <p className="font-semibold capitalize">
                      Odontograma {odonto.tipo}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Creado: {formatDate(odonto.fecha)}
                    </p>
                  </div>
                  {/* ¡MODIFICADO! Este botón ahora es un Link */}
                  <Link to={`/pacientes/${patientId}/odontograma/${odonto.id}`}>
                    <Button variant="outline" size="icon">
                      <Eye className="h-4 w-4" /> 
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ¡ELIMINADO! El editor modal ya no se renderiza aquí */}
    </div>
  );
};

export default PatientOdontogram;