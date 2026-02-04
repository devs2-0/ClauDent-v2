// Patient attachments management (Conectado a Firebase Storage y Firestore)
import React, { useState, useEffect } from 'react';
import { Upload, Eye, Trash2, FileText, Image, File } from 'lucide-react';
import { useApp } from '@/state/AppContext'; // Solo para 'currentUser'
import { Attachment } from '@/state/AppContext'; // Importamos el tipo
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
// ¡NUEVO! Importaciones de Firebase
import { db, storage } from '@/lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
  orderBy,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';

interface PatientAttachmentsProps {
  patientId: string;
}

const PatientAttachments: React.FC<PatientAttachmentsProps> = ({ patientId }) => {
  const { currentUser } = useApp(); // Para la ruta de Storage
  
  // ¡NUEVO! Estado local
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ¡NUEVO! Efecto para cargar adjuntos
  useEffect(() => {
    if (!patientId) return;

    setIsLoading(true);
    const attachmentsRef = collection(db, 'pacientes', patientId, 'adjuntos');
    const q = query(attachmentsRef, orderBy('fecha', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const attachmentsData: Attachment[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fecha: data.fecha?.toDate ? data.fecha.toDate().toISOString().split('T')[0] : 'N/A',
        } as Attachment;
      });
      setAttachments(attachmentsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);

  // ¡MODIFICADO! Lógica real de subida de archivos
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) {
      return;
    }

    setIsUploading(true);
    const uploadToast = toast.loading('Subiendo archivo...');

    try {
      // 1. Crear una referencia en Storage
      // ej: pacientes/ID_PACIENTE/nombrearchivo.pdf_TIMESTAMP
      const storagePath = `pacientes/${patientId}/${file.name}_${Date.now()}`;
      const storageRef = ref(storage, storagePath);

      // 2. Subir el archivo
      const uploadResult = await uploadBytes(storageRef, file);

      // 3. Obtener la URL de descarga
      const downloadURL = await getDownloadURL(uploadResult.ref);

      // 4. Crear el documento de metadata en Firestore
      const attachmentsRef = collection(db, 'pacientes', patientId, 'adjuntos');
      await addDoc(attachmentsRef, {
        nombre: file.name,
        tipo: file.type,
        fecha: serverTimestamp(),
        url: downloadURL,
        storagePath: storagePath, // ¡Importante! Guardamos la ruta
        subidoPor: currentUser.email, // Opcional: guardamos quién lo subió
      });

      toast.success('Archivo agregado correctamente', { id: uploadToast });
    } catch (error) {
      console.error("Error al subir archivo: ", error);
      toast.error('Error al subir el archivo', { id: uploadToast });
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Limpiar el input
    }
  };

  // ¡MODIFICADO! Lógica real de borrado
  const handleDelete = async (attachment: Attachment) => {
    if (deletingId) return; // Evitar doble click
    
    if (!confirm(`¿Eliminar ${attachment.nombre}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingId(attachment.id);
    const deleteToast = toast.loading('Eliminando archivo...');

    try {
      // 1. Borrar el archivo de Storage
      const storageRef = ref(storage, attachment.storagePath);
      await deleteObject(storageRef);

      // 2. Borrar el documento de Firestore
      const docRef = doc(db, 'pacientes', patientId, 'adjuntos', attachment.id);
      await deleteDoc(docRef);

      toast.success('Archivo eliminado', { id: deleteToast });
    } catch (error) {
      console.error("Error al eliminar archivo: ", error);
      toast.error('Error al eliminar el archivo', { id: deleteToast });
    } finally {
      setDeletingId(null);
    }
  };

  const getFileIcon = (tipo: string) => {
    if (tipo.startsWith('image/')) return Image;
    if (tipo.includes('pdf')) return FileText;
    return File;
  };

  // ¡NUEVO! Esqueleto de carga
  const AttachmentLoadingSkeleton = () => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-10" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Archivos Adjuntos</h3>
        <div>
          <Input
            id="file-upload"
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
            disabled={isUploading || isLoading}
          />
          <Label htmlFor="file-upload">
            <Button asChild disabled={isUploading || isLoading}>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Subiendo...' : 'Subir Archivo'}
              </span>
            </Button>
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AttachmentLoadingSkeleton />
          <AttachmentLoadingSkeleton />
          <AttachmentLoadingSkeleton />
        </div>
      ) : attachments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay archivos adjuntos. Sube el primer archivo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attachments.map((attachment) => {
            const Icon = getFileIcon(attachment.tipo);
            const isDeletingThis = deletingId === attachment.id;
            return (
              <Card key={attachment.id} className={cn("hover:shadow-md transition-shadow", isDeletingThis && "opacity-50")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={attachment.nombre}>
                        {attachment.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(attachment.fecha)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(attachment.url, '_blank')}
                      disabled={isDeletingThis || isUploading}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(attachment)}
                      disabled={isDeletingThis || isUploading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Eliminamos la nota de "simulación" */}
    </div>
  );
};

export default PatientAttachments;