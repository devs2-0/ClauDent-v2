import { useEffect, useId, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { formatDate } from "@/shared/utils/utils";
import { addDays, getDateRangeError, startOfCurrentMonth, today, type CashDateRange } from "../utils/cashFilters";

interface Props {
  value: CashDateRange;
  onApply: (range: CashDateRange) => void;
  report?: boolean;
}

export function CashDateRangeFilter({ value, onApply, report = false }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft({ start: value.start, end: value.end }), [value.start, value.end]);
  const error = getDateRangeError(draft, report);
  const changed = draft.start !== value.start || draft.end !== value.end;
  const apply = (range: CashDateRange) => { setDraft(range); onApply(range); };
  const label = value.start && value.end
    ? value.start === value.end ? `Solo el ${formatDate(value.start)}` : `Del ${formatDate(value.start)} al ${formatDate(value.end)}`
    : value.start ? `Desde el ${formatDate(value.start)}` : value.end ? `Hasta el ${formatDate(value.end)}` : "Todas las fechas";

  return (
    <div className="space-y-3">
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end" onSubmit={event => {
        event.preventDefault();
        if (!error) apply(draft);
      }}>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${id}-start`}>Desde</Label>
          <Input id={`${id}-start`} type="date" value={draft.start} required={report} aria-invalid={Boolean(error)} onChange={event => setDraft({ ...draft, start: event.target.value })} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${id}-end`}>Hasta (incluido)</Label>
          <Input id={`${id}-end`} type="date" value={draft.end} required={report} aria-invalid={Boolean(error)} onChange={event => setDraft({ ...draft, end: event.target.value })} />
        </div>
        <Button type="submit" disabled={Boolean(error)}>{report ? "Generar reporte" : "Buscar"}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {changed && <p className="text-sm text-amber-700">Fechas sin aplicar. Pulsa {report ? "Generar reporte" : "Buscar"} para actualizar los resultados.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => apply({ start: today(), end: today() })}>Hoy</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => apply({ start: addDays(today(), -6), end: today() })}>Últimos 7 días</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => apply({ start: startOfCurrentMonth(), end: today() })}>Este mes</Button>
        {!report && (value.start || value.end || draft.start || draft.end) && <Button type="button" variant="ghost" size="sm" onClick={() => apply({ start: "", end: "" })}>Quitar filtro de fechas</Button>}
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {report ? "Periodo del reporte" : "Filtro de fechas aplicado"}: <span className="font-medium text-foreground">{label}</span>.
        {report ? " Las descargas incluyen todo este periodo." : " Se incluyen ambos días completos."}
      </p>
    </div>
  );
}
