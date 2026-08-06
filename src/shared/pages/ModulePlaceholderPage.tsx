import { Construction } from "lucide-react";

interface ModulePlaceholderPageProps {
  title: string;
  description: string;
}

const ModulePlaceholderPage = ({
  title,
  description,
}: ModulePlaceholderPageProps) => {
  return (
    <main className="space-y-4">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Construction className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>

            <p className="mt-4 text-xs text-muted-foreground">
              Esta pantalla existe para validar rutas, permisos y navegación.
              La funcionalidad completa se implementará en su tarea
              correspondiente.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ModulePlaceholderPage;