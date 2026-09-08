import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { authService } from "@/auth/services/authService";
import { normalizeInvitationEmail } from "@/auth/services/userInvitationService";
import type { PermissionKey } from "@/auth/types/permission.types";
import type { AppUserStatus } from "@/auth/types/user.types";
import { db } from "@/lib/firebase";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface InvitationData {
  email: string;
  displayName: string;
  phone?: string | null;
  status: AppUserStatus;
  roleIds: string[];
  primaryRoleId?: string | null;
  permissions: PermissionKey[];
  isAdmin: boolean;
  staffType?: "administrative" | "doctor" | "assistant";
  doctorId?: string | null;
  assistantId?: string | null;
  consumed: boolean;
  cancelled?: boolean;
  createdBy?: string | null;
}

const FirstAccessPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    const normalizedEmail = normalizeInvitationEmail(email);
    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (!normalizedEmail) {
      toast.error("El correo es obligatorio.");
      return;
    }

    if (cleanPassword.length < 6) {
      toast.error("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      toast.error("Las contrasenas no coinciden.");
      return;
    }

    setLoading(true);

    let createdUser: User | null = null;

    try {
      const credential = await authService.createUser(
        normalizedEmail,
        cleanPassword,
      );

      createdUser = credential.user;

      const invitationRef = doc(db, "invitacionesUsuarios", normalizedEmail);
      const invitationSnap = await getDoc(invitationRef);

      if (!invitationSnap.exists()) {
        throw new Error(
          "No existe una invitacion pendiente para este correo. Verifica el correo o solicita acceso al administrador.",
        );
      }

      const invitation = invitationSnap.data() as InvitationData;

      if (invitation.consumed || invitation.cancelled) {
        throw new Error("Esta invitacion ya fue usada o cancelada.");
      }

      if (invitation.email !== normalizedEmail) {
        throw new Error("La invitacion no coincide con el correo ingresado.");
      }

      await authService.updateProfile(createdUser, {
        displayName: invitation.displayName,
      });

      const batch = writeBatch(db);
      const userRef = doc(db, "usuarios", createdUser.uid);

      batch.set(userRef, {
        uid: createdUser.uid,
        email: invitation.email,
        displayName: invitation.displayName,
        phone: invitation.phone ?? null,
        status: invitation.status ?? "active",
        roleIds: invitation.roleIds ?? [],
        primaryRoleId: invitation.primaryRoleId ?? invitation.roleIds?.[0] ?? null,
        permissions: invitation.permissions ?? [],
        isAdmin: invitation.isAdmin === true,
        photoURL: null,
        doctorId: invitation.doctorId ?? null,
        assistantId: invitation.assistantId ?? null,
        visible: true,
        invitationId: normalizedEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: invitation.createdBy ?? null,
        updatedBy: createdUser.uid,
        lastLoginAt: null,
      });

      batch.update(invitationRef, {
        consumed: true,
        consumedAt: serverTimestamp(),
        consumedBy: createdUser.uid,
        updatedAt: serverTimestamp(),
      });

      if (invitation.staffType === "doctor" && invitation.doctorId) {
        const doctorRef = doc(db, "doctores", invitation.doctorId);

        batch.update(doctorRef, {
          userUid: createdUser.uid,
          updatedAt: serverTimestamp(),
          updatedBy: createdUser.uid,
        });
      }

      if (invitation.staffType === "assistant" && invitation.assistantId) {
        const assistantRef = doc(db, "asistentes", invitation.assistantId);

        batch.update(assistantRef, {
          userUid: createdUser.uid,
          updatedAt: serverTimestamp(),
          updatedBy: createdUser.uid,
        });
      }

      await batch.commit();

      toast.success("Acceso creado correctamente. Bienvenido a ClauDent.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error(error);

      if (createdUser) {
        try {
          await authService.deleteUser(createdUser);
        } catch (deleteError) {
          console.error(deleteError);
          await authService.signOut().catch(() => undefined);
        }
      }

      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : "";

      if (code === "auth/email-already-in-use") {
        toast.error(
          "Ese correo ya tiene una cuenta. Inicia sesion o usa recuperar contrasena.",
        );
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo completar el primer acceso.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Primer acceso</CardTitle>
          <CardDescription>
            Usa el correo que el administrador invito y crea tu contrasena para
            entrar a ClauDent.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="first-access-email">Correo invitado</Label>
              <Input
                id="first-access-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="empleado@claudent.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="first-access-password">Contrasena</Label>
              <div className="relative">
                <Input
                  id="first-access-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimo 6 caracteres"
                  autoComplete="new-password"
                  className="pr-10"
                  disabled={loading}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={loading}
                  aria-label={
                    showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="first-access-confirm-password">
                Confirmar contrasena
              </Label>
              <Input
                id="first-access-confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repite tu contrasena"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Creando acceso..." : "Crear mi acceso"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Ya tienes cuenta?{" "}
            {loading ? (
              <span aria-disabled="true" className="font-medium">
                Inicia sesion
              </span>
            ) : (
              <Link
                to="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Inicia sesion
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default FirstAccessPage;
