import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Table } from "@/shared/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import "./InventoryTable.css";

interface InventoryTableProps {
  label: string;
  className?: string;
  children: React.ReactNode;
}

export const InventoryTable = ({ label, className, children }: InventoryTableProps) => {
  const viewportId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [scroll, setScroll] = useState({ left: 0, width: 0, total: 0 });

  const updateScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const next = { left: viewport.scrollLeft, width: viewport.clientWidth, total: viewport.scrollWidth };
    setScroll((current) => current.left === next.left && current.width === next.width && current.total === next.total
      ? current
      : next);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const table = tableRef.current;
    if (!viewport || !table) return;

    const observer = new ResizeObserver(updateScroll);
    observer.observe(viewport);
    observer.observe(table);
    updateScroll();
    return () => observer.disconnect();
  }, [updateScroll]);

  const maxScroll = Math.max(0, scroll.total - scroll.width);
  const hasOverflow = maxScroll > 1;
  const scrollByPage = (direction: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const actionWidth = tableRef.current?.querySelector<HTMLElement>("[data-pinned-actions]")?.offsetWidth ?? 0;
    viewport.scrollBy({
      left: direction * Math.max(80, (viewport.clientWidth - actionWidth) * 0.8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  return (
    <div className="min-w-0 max-w-full">
      {hasOverflow && (
        <div role="group" aria-label={`Columnas de ${label}`} className="flex items-center gap-3 border-y bg-muted/40 px-3 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label="Columnas anteriores"
                aria-controls={viewportId}
                disabled={scroll.left <= 1}
                onClick={() => scrollByPage(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Columnas anteriores</TooltipContent>
          </Tooltip>
          <input
            type="range"
            className="inventory-table-scrollbar min-w-0 flex-1"
            style={{ "--inventory-scroll-thumb-width": `${scroll.width / scroll.total * 100}%` } as React.CSSProperties}
            aria-label={`Desplazamiento horizontal de ${label}`}
            aria-controls={viewportId}
            min={0}
            max={maxScroll}
            step={1}
            value={Math.min(maxScroll, Math.max(0, scroll.left))}
            onChange={(event) => {
              viewportRef.current?.scrollTo({ left: Number(event.target.value), behavior: "instant" });
              updateScroll();
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label="Columnas siguientes"
                aria-controls={viewportId}
                disabled={scroll.left >= maxScroll - 1}
                onClick={() => scrollByPage(1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Columnas siguientes</TooltipContent>
          </Tooltip>
        </div>
      )}
      <Table
        ref={tableRef}
        className={className}
        containerProps={{
          ref: viewportRef,
          id: viewportId,
          role: "region",
          "aria-label": label,
          tabIndex: hasOverflow ? 0 : undefined,
          onScroll: updateScroll,
          className: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        }}
      >
        {children}
      </Table>
    </div>
  );
};
