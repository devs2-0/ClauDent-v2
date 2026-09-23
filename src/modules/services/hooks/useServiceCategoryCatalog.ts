import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { useAuth, useCan } from '@/auth';
import { db } from '@/lib/firebase';
import { legacyCategories, type ServiceCategory } from '../utils/categoryCatalog';

const catalogRef = () => doc(db, 'configuracionModulos', 'servicios');
export const useServiceCategoryCatalog = (legacyValues: string[], canRead: boolean, legacyReady: boolean) => {
  const { currentUser } = useAuth();
  const { can } = useCan();
  const [stored, setStored] = useState<ServiceCategory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    setStored(null);
    setUnavailable(false);
    if (!currentUser || !canRead) { setLoading(false); return; }
    setLoading(true);
    return onSnapshot(catalogRef(), (snapshot) => {
      setStored(snapshot.exists() ? snapshot.data().categories ?? [] : null);
      setLoading(false);
    }, () => { setUnavailable(true); setLoading(false); });
  }, [currentUser, canRead]);
  const categories = useMemo(() => stored ?? legacyCategories(legacyValues), [stored, legacyValues]);
  const updateCategories = async (transform: (current: ServiceCategory[]) => ServiceCategory[]) => {
    if (!can('settings.view') || !can('settings.update')) throw new Error('No tienes permiso para configurar categorías.');
    if (loading || unavailable) throw new Error('Espera a que el catálogo esté disponible.');
    if (stored === null && !legacyReady) throw new Error("Para iniciar el catálogo, carga los servicios con permiso de consulta y vuelve a intentarlo.");
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(catalogRef());
      const current = snapshot.exists() ? snapshot.data().categories as ServiceCategory[] : categories;
      transaction.set(catalogRef(), { categories: transform(current) });
    });
  };
  return { categories, categoriesLoading: loading, categoriesUnavailable: unavailable, catalogConfigured: stored !== null, updateCategories };
};
