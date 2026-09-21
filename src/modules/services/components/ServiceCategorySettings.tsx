import { useState } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/auth';
import { useDentalServicesContext } from '../store/DentalServicesProvider';
import { saveCategory, type ServiceCategory } from '../utils/categoryCatalog';
import { useConfirmAction } from '@/shared/hooks/useConfirmAction';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';

export default function ServiceCategorySettings() {
  const { can } = useCan();
  const { categories, categoriesLoading, categoriesUnavailable, catalogConfigured, updateCategories } = useDentalServicesContext();
  const { confirm, confirmationDialog } = useConfirmAction();
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const canUpdate = can('settings.update');
  const persist = async (transform: (current: ServiceCategory[]) => ServiceCategory[]) => {
    setSaving(true);
    try { await updateCategories(transform); setName(''); setEditing(null); toast.success('Catálogo actualizado.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar el catálogo.'); }
    finally { setSaving(false); }
  };
  if (!can('settings.view')) return null;
  return <Card>
    <CardHeader><CardTitle>Categorías de servicios</CardTitle><CardDescription>Opciones compartidas del catálogo. Al eliminar una categoría, sus servicios quedan sin categoría; sus datos históricos se conservan.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {categoriesLoading ? <p>Cargando categorías…</p> : categoriesUnavailable ? <p role="status">Catálogo no disponible. Revisa los permisos de configuración.</p> : <>
        {!catalogConfigured && <p className="text-sm text-muted-foreground">Opciones iniciales obtenidas de los servicios existentes. El primer cambio guarda este catálogo sin modificar los documentos de servicios.</p>}
        {canUpdate && <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); const id = editing?.id ?? crypto.randomUUID(); void persist((current) => saveCategory(current, name, id)); }}>
          <div className="flex-1 space-y-1"><Label htmlFor="category-name">{editing ? 'Editar categoría' : 'Nueva categoría'}</Label><Input id="category-name" value={name} maxLength={80} required disabled={saving} onChange={(event) => setName(event.target.value)} /></div>
          <Button disabled={saving}>{editing ? 'Guardar' : 'Crear'}</Button>
          {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setName(''); }}>Cancelar</Button>}
        </form>}
        <div className="divide-y rounded-lg border">
          {categories.length === 0 && <p className="p-3 text-sm text-muted-foreground">Sin categorías configuradas.</p>}
          {categories.map((category) => <div key={category.id} className="flex items-center justify-between gap-2 p-3">
            <span className="text-sm">{category.name}</span>
            {canUpdate && <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setEditing(category); setName(category.name); }}>Editar</Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={async () => {
                if (await confirm({ title: 'Eliminar categoría', description: `Se eliminará ${category.name} del catálogo. Sus servicios quedarán sin categoría y los registros históricos conservarán sus datos.`, confirmLabel: 'Eliminar', destructive: true })) await persist((current) => current.filter((item) => item.id !== category.id));
              }}>Eliminar</Button>
            </div>}
          </div>)}
        </div>
      </>}
      {confirmationDialog}
    </CardContent>
  </Card>;
}
