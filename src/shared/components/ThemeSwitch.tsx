import { Moon, Sun } from "lucide-react";

import { useAppearance } from "@/shared/appearance";
import { Switch } from "@/shared/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

export const ThemeSwitch = () => {
  const { mode, saving, setMode } = useAppearance();
  const isDark = mode === "dark";
  const label = isDark ? "Desactivar modo oscuro" : "Activar modo oscuro";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-muted/30 px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
          {isDark ? (
            <Moon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only">{label}</span>
          <Switch
            checked={isDark}
            disabled={saving}
            aria-label={label}
            onCheckedChange={(checked) => void setMode(checked ? "dark" : "light")}
          />
        </label>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

