// (NUEVO ARCHIVO) src/pages/ResetPassword.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Stethoscope, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Hook simple para leer los parámetros de la URL (el código secreto de Firebase)
function useQuery() {
    return new URLSearchParams(useLocation().search);
    }

    const ResetPassword: React.FC = () => {
    const query = useQuery();
    const navigate = useNavigate();
    const oobCode = query.get('oobCode'); // El código secreto que viene en el email

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const [isVerifying, setIsVerifying] = useState(true);
    const [isValidCode, setIsValidCode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // 1. Al cargar, verificamos si el código del link es válido
    useEffect(() => {
        if (!oobCode) {
        setIsVerifying(false);
        setIsValidCode(false);
        return;
        }

        verifyPasswordResetCode(auth, oobCode)
        .then(() => {
            setIsValidCode(true);
            setIsVerifying(false);
        })
        .catch((error) => {
            console.error(error);
            setIsValidCode(false);
            setIsVerifying(false);
        });
    }, [oobCode]);

    // 2. Guardar la nueva contraseña
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
        toast.error('Las contraseñas no coinciden');
        return;
        }
        if (password.length < 6) {
        toast.error('La contraseña debe tener al menos 6 caracteres');
        return;
        }
        if (!oobCode) return;

        setIsSaving(true);
        try {
        await confirmPasswordReset(auth, oobCode, password);
        setIsSuccess(true);
        toast.success('Contraseña actualizada correctamente');
        // Redirigir al login después de 3 segundos
        setTimeout(() => navigate('/login'), 3000);
        } catch (error: any) {
        console.error(error);
        toast.error('Error al restablecer la contraseña. Intenta de nuevo.');
        } finally {
        setIsSaving(false);
        }
    };

    // --- RENDERIZADO DE ESTADOS ---

    if (isVerifying) {
        return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <p className="text-muted-foreground animate-pulse">Verificando enlace...</p>
        </div>
        );
    }

    if (!isValidCode) {
        return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Enlace inválido o expirado</h1>
            <p className="text-muted-foreground">
                El enlace para restablecer la contraseña ya no es válido. Es posible que ya haya sido usado o haya caducado.
            </p>
            <Button onClick={() => navigate('/login')}>Volver al inicio</Button>
            </div>
        </div>
        );
    }

    if (isSuccess) {
        return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">¡Contraseña Actualizada!</h1>
            <p className="text-muted-foreground">
                Tu contraseña ha sido cambiada con éxito. Ahora puedes iniciar sesión con tu nueva clave.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">Ir a Iniciar Sesión</Button>
            </div>
        </div>
        );
    }

    // --- FORMULARIO PRINCIPAL ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted to-accent flex items-center justify-center p-4">
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
        >
            <div className="bg-card rounded-3xl shadow-lg p-8 border border-border">
            <div className="flex flex-col items-center mb-8">
                <img src="/logo.png" alt="ClauDent" className="w-36 object-contain mb-4" /> 
                <h1 className="text-2xl font-bold text-foreground mb-2">Nueva Contraseña</h1>
                <p className="text-muted-foreground text-center text-sm">
                Ingresa tu nueva contraseña para ClauDent
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                <Label htmlFor="password">Nueva Contraseña</Label>
                <div className="relative">
                    <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pr-10"
                    />
                    <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                    <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Repite la contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="h-12"
                    />
                </div>

                <Button type="submit" className="w-full h-12" size="lg" disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Cambiar Contraseña'}
                </Button>
            </form>
            </div>
        </motion.div>
        </div>
    );
};

export default ResetPassword;