import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/utils/utils";

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  fromYear?: number;
  toYear?: number;
  className?: string;
}

const parseDateValue = (value?: string) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

const formatDateValue = (date: Date) => format(date, "yyyy-MM-dd");

const formatDisplayDate = (date: Date) => format(date, "d 'de' MMMM 'de' yyyy", { locale: es });

export const DatePickerField = ({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  required = false,
  min,
  max,
  fromYear = 1900,
  toYear = new Date().getFullYear() + 10,
  className,
}: DatePickerFieldProps) => {
  const [open, setOpen] = React.useState(false);
  const selectedDate = parseDateValue(value);
  const minDate = parseDateValue(min);
  const maxDate = parseDateValue(max);

  const isDateDisabled = React.useCallback(
    (date: Date) => {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      return false;
    },
    [maxDate, minDate],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-required={required}
          className={cn(
            "w-full justify-start gap-2 bg-background px-3 text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{selectedDate ? formatDisplayDate(selectedDate) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatDateValue(date));
            setOpen(false);
          }}
          disabled={minDate || maxDate ? isDateDisabled : undefined}
          captionLayout="dropdown-buttons"
          fromYear={fromYear}
          toYear={toYear}
          locale={es}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};
