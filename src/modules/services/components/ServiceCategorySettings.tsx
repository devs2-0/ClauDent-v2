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
import { Skeleton } from '@/shared/components/ui/skeleton';
import { AlertCircle, Lock, Pencil, Plus, Tags, Trash2 } from 'lucide-react';

export default function ServiceCategorySettings() {
  const { can } = useCan();
  const { categories, categoriesLoading, categoriesUnavailable, catalogConfigured, updateCategories } = useDentalServicesContext();
  const { confirm, confirmationDialog } = useConfirmAction();
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const canUpdate = can('settings.view') && can('settings.update');
  const persist = async (transform: (current: ServiceCategory[]) => ServiceCategory[]) => {
    setSaving(true);
    try { await updateCategories(transform); setName(''); setEditing(null); toast.success('Catálogo actualizado.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar el catálogo.'); }
    finally { setSaving(false); }
  };
  if (!can('settings.view')) return null;
  return <Card className="overflow-hidden border-border/70 shadow-sm">
    <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <Tags className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg">Categorías de servicios</CardTitle>
            <CardDescription>Organiza el catálogo para facilitar búsquedas y filtros.</CardDescription>
          </div>
        </div>
        {!categoriesLoading && !categoriesUnavailable && <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
        </span>}
      </div>
    </CardHeader>
    <CardContent className="space-y-4 p-5">
      {categoriesLoading ? <div className="space-y-3" role="status" aria-label="Cargando categorías">
        {[0, 1, 2].map((item) => <div key={item} className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-4 w-36" /></div>
          <Skeleton className="h-8 w-24" />
        </div>)}
      </div> : categoriesUnavailable ? <div role="status" className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">No se pudo cargar el catálogo de categorías.</p>
          <p className="text-muted-foreground">Actualiza la página para volver a intentarlo.</p>
        </div>
      </div> : <>
        {!catalogConfigured && <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
          Las categorías actuales se detectaron desde los servicios existentes.
        </div>}
        {canUpdate ? <form className="rounded-lg border bg-muted/20 p-3" onSubmit={(event) => { event.preventDefault(); const id = editing?.id ?? crypto.randomUUID(); void persist((current) => saveCategory(current, name, id)); }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="category-name">{editing ? 'Editar categoría' : 'Nueva categoría'}</Label>
              <Input id="category-name" value={name} maxLength={80} required disabled={saving} placeholder="Ej. Ortodoncia" onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 sm:flex-none" disabled={saving}>
                {editing ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {editing ? 'Guardar' : 'Crear categoría'}
              </Button>
              {editing && <Button type="button" variant="outline" disabled={saving} onClick={() => { setEditing(null); setName(''); }}>Cancelar</Button>}
            </div>
          </div>
        </form> : <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          Catálogo disponible en modo solo lectura.
        </div>}
        {categories.length === 0 ? <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Tags className="h-5 w-5" /></div>
          <p className="font-medium">Aún no hay categorías</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{canUpdate ? 'Crea la primera categoría para organizar tus servicios.' : 'No hay categorías disponibles para consultar.'}</p>
        </div> : <div className="overflow-hidden rounded-lg border bg-background/60">
          <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Catálogo</div>
          <div className="divide-y">
            {categories.map((category) => <div key={category.id} className="flex flex-col gap-2 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Tags className="h-4 w-4" /></span>
                <span className="truncate text-sm font-medium">{category.name}</span>
              </div>
              {canUpdate && <div className="flex gap-1 self-end sm:self-auto">
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setEditing(category); setName(category.name); }}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={saving} onClick={async () => {
                  if (await confirm({ title: 'Eliminar categoría', description: `Se eliminará ${category.name} del catálogo. Sus servicios quedarán sin categoría y los registros históricos conservarán sus datos.`, confirmLabel: 'Eliminar', destructive: true })) await persist((current) => current.filter((item) => item.id !== category.id));
                }}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar
                </Button>
              </div>}
            </div>)}
          </div>
        </div>}
      </>}
      {confirmationDialog}
    </CardContent>
  </Card>;
}
