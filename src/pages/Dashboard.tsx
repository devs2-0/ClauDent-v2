// RF11: Dashboard (RESPONSIVE TABLET)
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Stethoscope, FileText, TrendingUp, Search, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '@/state/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const Dashboard: React.FC = () => {
  const { patients, services, quotations, currentUser, paquetes, paquetesLoading, patientsLoading } = useApp();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');

  const stats = [
    {
      title: 'Total Pacientes',
      value: patients.length,
      icon: Users,
      description: `${patients.filter(p => p.estado === 'activo').length} activos`,
      color: 'text-primary',
      link: '/pacientes',
    },
    {
      title: 'Servicios',
      value: services.length,
      icon: Stethoscope,
      description: `${services.filter(s => s.estado === 'activo').length} disponibles`,
      color: 'text-secondary',
      link: '/servicios',
    },
    {
      title: 'Cotizaciones',
      value: quotations.length,
      icon: FileText,
      description: 'Total generadas',
      color: 'text-accent',
      link: '/cotizaciones',
    },
  ];

  const recentPatients = patients.slice(0, 10); 

  const today = new Date().toISOString().split('T')[0];
  const activePaquetes = useMemo(() => {
    return paquetes.filter(p =>
      p.estado === 'activo' &&
      p.fechaInicio <= today &&
      p.fechaFin >= today &&
      p.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [paquetes, searchQuery, today]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Bienvenido
        </h1>
        <p className="text-muted-foreground">
          Aquí está el resumen de tu consultorio
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={stat.link}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground mb-1">
                      {stat.value}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Accesos Rápidos</CardTitle>
          <CardDescription>Acciones frecuentes</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Link to="/pacientes">
            <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
              <Users className="h-6 w-6" />
              <span className="text-sm">Nuevo Paciente</span>
            </Button>
          </Link>
          <Link to="/cotizaciones">
            <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span className="text-sm">Nueva Cotización</span>
            </Button>
          </Link>
          <Link to="/servicios">
            <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
              <Stethoscope className="h-6 w-6" />
              <span className="text-sm">Ver Servicios</span>
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        
        {/* 1. Paquetes Activos */}
        <Card className="h-[400px] flex flex-col overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Paquetes Activos</CardTitle>
                <CardDescription>Promociones vigentes</CardDescription>
              </div>
            </div>
            <div className="relative w-full mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar paquetes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <div className="h-full overflow-auto">
              {/* Contenedor interno ancho para evitar aplastamiento en tablet */}
              <div className="min-w-[600px] p-6 pt-0 space-y-4">
                {paquetesLoading ? (
                  Array(2).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl border">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1 flex-1 ml-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))
                ) : activePaquetes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-10">
                    {searchQuery ? "No se encontraron paquetes" : "No hay paquetes activos vigentes."}
                  </p>
                ) : (
                  activePaquetes.map((paquete) => (
                    <div
                      key={paquete.id}
                      onClick={() => navigate('/servicios')}
                      className="flex items-center justify-between p-4 rounded-2xl border hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-secondary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {paquete.nombre}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Hasta: {formatDate(paquete.fechaFin)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-lg font-bold text-foreground">{formatCurrency(paquete.precioTotal)}</p>
                        <Badge variant="secondary" className="ml-auto w-fit block">{paquete.serviciosIncluidos.length} servicios</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Pacientes Recientes */}
        <Card className="h-[400px] flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Pacientes Recientes</CardTitle>
            <CardDescription>Últimos registros</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <div className="h-full overflow-auto">
              {/* Contenedor interno ancho */}
              <div className="min-w-[600px] p-6 pt-0 space-y-4">
                {patientsLoading ? (
                  <p className="text-muted-foreground p-4">Cargando pacientes...</p>
                ) : recentPatients.length === 0 ? (
                  <p className="text-muted-foreground text-center py-10">No hay pacientes recientes.</p>
                ) : (
                  recentPatients.map((patient) => (
                    <Link
                      key={patient.id}
                      to={`/pacientes/${patient.id}`}
                      className="flex items-center justify-between p-4 rounded-2xl border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-semibold">
                            {patient.nombres && patient.nombres[0]}
                            {patient.apellidos && patient.apellidos[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {patient.nombres} {patient.apellidos}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {patient.curp || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <TrendingUp className="h-5 w-5 text-muted-foreground shrink-0 ml-4" />
                    </Link>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;