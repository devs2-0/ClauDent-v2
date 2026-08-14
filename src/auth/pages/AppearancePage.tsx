import { MonitorCog, Moon, Sun } from "lucide-react";

import { useAppearance } from "@/shared/appearance";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import type { UserAppearanceMode } from "../types/user.types";

const options: Array<{
  value: UserAppearanceMode;
  title: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    title: "Modo normal",
    description: "Interfaz clara para uso diario en consultorio.",
    icon: Sun,
  },
  {
    value: "dark",
    title: "Modo oscuro",
    description: "Reduce brillo en turnos largos o espacios con poca luz.",
    icon: Moon,
  },
];

const AppearancePage = () => {
  const { mode, saving, setMode } = useAppearance();

  const handleModeChange = (value: string) => {
    void setMode(value as UserAppearanceMode);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Apariencia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajusta el modo visual del sistema. La preferencia se sincroniza con tu perfil.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-2">
          <MonitorCog className="h-4 w-4" />
          {mode === "dark" ? "Oscuro" : "Normal"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tema de interfaz</CardTitle>
          <CardDescription>
            Se aplicara automaticamente cada vez que inicies sesion con este usuario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={handleModeChange} className="grid gap-3 md:grid-cols-2">
            {options.map((option) => {
              const Icon = option.icon;
              const selected = mode === option.value;

              return (
                <Label
                  key={option.value}
                  htmlFor={`appearance-${option.value}`}
                  className="flex min-h-28 cursor-pointer items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <RadioGroupItem id={`appearance-${option.value}`} value={option.value} className="mt-1" />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {option.title}
                      {selected && <Badge>Activo</Badge>}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{option.description}</span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>

          <div className="mt-6 flex justify-end">
            <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {saving ? "Guardando..." : "Guardado por perfil"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppearancePage;
