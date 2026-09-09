import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { useAuth } from "@/auth/hooks/useAuth";
import { authService } from "@/auth/services/authService";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { authLoading, currentUser } = useAuth();

  useEffect(() => {
    if (isLoading && currentUser && !authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, currentUser, isLoading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isLoading) return;

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      toast.error("Por favor, ingresa email y contrasena");
      return;
    }

    setIsLoading(true);

    try {
      await authService.signIn(cleanEmail, password);
    } catch (error: any) {
      console.error(error);

      let errorMessage = "Error al iniciar sesion";

      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        errorMessage = "Email o contrasena incorrectos";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El formato del email es incorrecto";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Demasiados intentos fallidos. Intenta mas tarde.";
      }

      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      toast.error("Por favor, escribe tu correo en el campo de Email primero.");
      return;
    }

    const loadingToast = toast.loading("Enviando correo de recuperacion...");

    try {
      await authService.sendPasswordReset(cleanEmail);
      toast.dismiss(loadingToast);
      toast.success("Listo. Revisa tu correo para restablecer tu contrasena.");
    } catch (error: any) {
      console.error(error);
      toast.dismiss(loadingToast);

      let errorMessage = "No se pudo enviar el correo.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No existe una cuenta con este correo.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El formato del correo es incorrecto.";
      }

      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-background via-muted to-accent p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-8 flex flex-col items-center">
            <img
              src="/logo.png"
              alt="ClauDent"
              className="mb-4 w-36 object-contain"
            />

            <h1 className="mb-2 text-3xl font-bold text-foreground">ClauDent</h1>
            <p className="text-center text-muted-foreground">
              Sistema de Gestion Dental
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="h-12"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Contrasena</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-medium text-primary hover:underline focus:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
                  disabled={isLoading}
                >
                  Olvide mi contrasena
                </button>
              </div>

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none disabled:cursor-not-allowed"
                  tabIndex={-1}
                  disabled={isLoading}
                  aria-label={
                    showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full disabled:bg-primary disabled:opacity-100"
              size="lg"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Iniciando sesion...
                </>
              ) : (
                "Iniciar sesion"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLoading ? (
              <span aria-disabled="true">Primer acceso? Crear contrasena</span>
            ) : (
              <Link
                to="/primer-acceso"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Primer acceso? Crear contrasena
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
