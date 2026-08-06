import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";

const SinPermisosPage = () => {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <section className="max-w-lg w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground">
          Sin permisos
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Tu usuario no tiene permisos para acceder a esta sección o realizar
          esta acción. Si crees que esto es un error, solicita la revisión de
          tus permisos al administrador del consultorio.
        </p>

        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link to="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
};

export default SinPermisosPage;