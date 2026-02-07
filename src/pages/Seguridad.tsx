import React from 'react';
import { useApp } from '@/state/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Tablet, LogOut, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';

const Seguridad: React.FC = () => {
  const { sessions, revokeSession, closeAllOtherSessions } = useApp();

  const getIcon = (type: string) => {
    if (type === "Celular") return <Smartphone className="h-6 w-6" />;
    if (type === "Tablet") return <Tablet className="h-6 w-6" />;
    return <Monitor className="h-6 w-6" />;
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold flex items-center gap-2 italic text-primary">
          <ShieldCheck className="h-9 w-9" /> Seguridad de Acceso
        </h1>
        <p className="text-muted-foreground text-sm">Gestiona tus dispositivos activos y protege tu cuenta dental.</p>
      </div>

      <Card className="shadow-xl border-primary/20 bg-background/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-6 bg-muted/20">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              Dispositivos Conectados
            </CardTitle>
            <CardDescription className="font-medium text-slate-500">Sesiones activas en la plataforma</CardDescription>
          </div>
          {sessions.length > 1 && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={closeAllOtherSessions}
              className="font-bold shadow-lg hover:scale-105 transition-transform"
            >
              Cerrar todas las demás
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {sessions.map((session) => (
            <div 
              key={session.id} 
              className={`flex items-center justify-between p-5 border-2 rounded-2xl transition-all ${
                session.isCurrent 
                ? 'bg-primary/5 border-primary/40 ring-2 ring-primary/10 shadow-inner' 
                : 'bg-white border-slate-100 hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-full shadow-md ${
                  session.isCurrent ? 'bg-primary text-white' : 'bg-muted text-slate-500'
                }`}>
                  {getIcon(session.deviceType)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="font-extrabold text-slate-800">{session.deviceType} • {session.browser}</p>
                    {session.isCurrent ? (
                      <Badge className="bg-primary text-white border-none px-3 py-0.5 text-[10px] animate-pulse font-black uppercase">
                        Este Navegador (Tú)
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 px-3 py-0.5 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="h-3 w-3" /> Sesión Abierta
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary opacity-70" /> 
                    {session.isCurrent ? 'Activo en este momento' : 'Sesión remota conectada'}
                  </p>
                </div>
              </div>
              
              {!session.isCurrent && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all hover:rotate-12"
                  onClick={() => revokeSession(session.id)}
                  title="Cerrar esta sesión remotamente"
                >
                  <LogOut className="h-6 w-6" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl shadow-sm">
        <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
           💡 Tip de Seguridad
        </h4>
        <p className="text-xs text-blue-700 mt-1.5 font-medium leading-relaxed">
          Si ves un dispositivo sospechoso con la etiqueta <span className="font-black text-emerald-700 underline">Sesión Abierta</span> que no reconoces, ciérrala de inmediato y cambia tu contraseña.
        </p>
      </div>
    </div>
  );
};

export default Seguridad;