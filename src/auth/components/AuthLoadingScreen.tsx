import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface AuthLoadingScreenProps {
  message?: string;
  className?: string;
}

export const AuthLoadingScreen = ({
  message = "Comprobando sesion...",
  className,
}: AuthLoadingScreenProps) => (
  <div
    className={cn(
      "flex min-h-screen items-center justify-center bg-background",
      className,
    )}
  >
    <div className="flex flex-col items-center gap-2" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  </div>
);
