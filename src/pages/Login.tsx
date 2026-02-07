// RF01: Login page (CON RECUPERACIÓN INTEGRADA)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Eye, EyeOff } from 'lucide-react'; 
import { motion } from 'framer-motion';
// Importamos sendPasswordResetEmail
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // --- Iniciar Sesión ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Por favor, ingresa email y contraseña');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Error al iniciar sesión';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Email o contraseña incorrectos';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El formato del email es incorrecto';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos fallidos. Intenta más tarde.';
      }
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Recuperar Contraseña (¡NUEVO!) ---
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Por favor, escribe tu correo en el campo de Email primero.');
      return;
    }

    const loadingToast = toast.loading('Enviando correo de recuperación...');

    try {
      await sendPasswordResetEmail(auth, email);
      toast.dismiss(loadingToast);
      toast.success('¡Listo! Revisa tu correo para restablecer tu contraseña.');
    } catch (error: any) {
      console.error(error);
      toast.dismiss(loadingToast);
      let errorMessage = 'No se pudo enviar el correo.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No existe una cuenta con este correo.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El formato del correo es incorrecto.';
      }
      toast.error(errorMessage);
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-br from-background via-muted to-accent flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-3xl shadow-lg p-8 border border-border">
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="ClauDent" className="w-36 object-contain mb-4" /> 
          
            <h1 className="text-3xl font-bold text-foreground mb-2">ClauDent</h1>
            <p className="text-muted-foreground text-center">
              Sistema de Gestión Dental
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
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-12"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                
                {/* BOTÓN DE RECUPERACIÓN DIRECTA */}
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary hover:underline font-medium focus:outline-none"
                  disabled={isLoading}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-12" size="lg" disabled={isLoading}>
              {isLoading ? 'Iniciando...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;