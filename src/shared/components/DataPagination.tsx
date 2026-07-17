import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { PAGE_SIZE_OPTIONS, type PageSizeOption } from "@/shared/hooks/usePagination";
import { cn } from "@/shared/utils/utils";

interface DataPaginationProps {
  page: number;
  pageSize: PageSizeOption;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPageSizeChange: (pageSize: PageSizeOption) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  itemLabel?: string;
  className?: string;
}

export const DataPagination = ({
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  canPreviousPage,
  canNextPage,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
  itemLabel = "registros",
  className,
}: DataPaginationProps) => {
  const rangeLabel = totalItems === 0 ? `0 de 0 ${itemLabel}` : `${startIndex + 1}-${endIndex} de ${totalItems} ${itemLabel}`;

  return (
    <div className={cn("flex flex-col gap-3 border-t bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Filas por pagina</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as PageSizeOption)}>
          <SelectTrigger className="h-9 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="text-sm font-medium text-muted-foreground">{rangeLabel}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPreviousPage}
            disabled={!canPreviousPage}
            className="h-9 w-9"
            aria-label="Pagina anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNextPage}
            disabled={!canNextPage}
            className="h-9 w-9"
            aria-label="Pagina siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
