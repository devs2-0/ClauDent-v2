import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id?: string;
  options: SearchableSelectOption[];
  value: string;
  inputValue?: string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
  customValueLabel?: (query: string) => string;
  onValueChange: (
    value: string,
    option?: SearchableSelectOption,
  ) => void;
  onInputValueChange?: (value: string) => void;
  onCustomValue?: (query: string) => void;
}

const normalizeText = (value: string) => {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const SearchableSelect = ({
  id,
  options,
  value,
  inputValue,
  placeholder = "Buscar...",
  emptyMessage = "Sin resultados.",
  disabled = false,
  allowCustomValue = false,
  customValueLabel,
  onValueChange,
  onInputValueChange,
  onCustomValue,
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState("");

  const selectedOption = options.find((option) => option.value === value);

  const query = inputValue ?? localQuery;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());

    if (!normalizedQuery) {
      return options.slice(0, 12);
    }

    return options
      .filter((option) => {
        const optionText = normalizeText(
          [
            option.label,
            option.description ?? "",
            option.searchText ?? "",
          ].join(" "),
        );

        return optionText.includes(normalizedQuery);
      })
      .slice(0, 12);
  }, [options, query]);

  const visibleValue = open
    ? query
    : inputValue ?? selectedOption?.label ?? "";

  const handleInputChange = (nextValue: string) => {
    if (onInputValueChange) {
      onInputValueChange(nextValue);
    } else {
      setLocalQuery(nextValue);
    }

    setOpen(true);
  };

  const handleSelect = (option: SearchableSelectOption) => {
    if (option.disabled) return;

    onValueChange(option.value, option);

    if (!onInputValueChange) {
      setLocalQuery("");
    }

    setOpen(false);
  };

  const handleClear = () => {
    onValueChange("", undefined);
    onInputValueChange?.("");
    setLocalQuery("");
    setOpen(false);
  };

  const handleCustomValue = () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) return;

    onCustomValue?.(trimmedQuery);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          id={id}
          value={visibleValue}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-9 pr-10"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          onChange={(event) => handleInputChange(event.target.value)}
        />

        {(value || inputValue) && !disabled && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
            aria-label="Limpiar selección"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                className="flex w-full items-start justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                <span>
                  <span className="block font-medium">{option.label}</span>

                  {option.description && (
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>

                {option.value === value && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                )}
              </button>
            ))
          )}

          {allowCustomValue && query.trim() && (
            <div className="mt-1 border-t pt-1">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-3 py-2 text-left text-sm"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleCustomValue}
              >
                {customValueLabel
                  ? customValueLabel(query.trim())
                  : `Usar "${query.trim()}"`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;