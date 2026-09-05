import { useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

interface SectionHelpProps {
  title: string;
  children: ReactNode;
}

/**
 * Mantiene la explicación de una página disponible sin ocupar espacio fijo.
 * El diálogo incluye su botón X nativo, cierre con Escape y al hacer clic fuera.
 */
export const SectionHelp = ({ title, children }: SectionHelpProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={`Ver ayuda de ${title}`}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>¿Para qué sirve esta sección?</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto rounded-xl p-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Información de esta sección.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pr-4 text-sm leading-6 text-foreground">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
