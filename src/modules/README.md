# Modulos - ClauDent

ClauDent usa una arquitectura modular por dominio. Cada dominio funcional vive en `src/modules`.

## Modulos actuales

```txt
audit/        Bitacora
dashboard/    Resumen operativo
packages/     Paquetes/promociones
patients/     Pacientes, ficha, historia clinica, adjuntos y odontograma
quotations/   Cotizaciones y PDF
security/     Vista de sesiones activas
services/     Catalogo de servicios dentales
agenda/       Estructura reservada
inventario/   Estructura reservada
ventas/       Estructura reservada
```

## Estructura interna

```txt
components/   Componentes propios del modulo
hooks/        Hooks publicos del modulo
pages/        Pantallas conectadas al router
services/     Funciones de persistencia o integraciones del modulo
store/        Providers/contextos del modulo
types/        Tipos TypeScript del dominio
index.ts      Exportaciones publicas
```

## Reglas

- Importar desde el `index.ts` del modulo cuando algo se use fuera del modulo.
- Evitar imports profundos entre modulos.
- No agregar logica nueva en un contexto global.
- Agenda, inventario y ventas deben crecer dentro de sus carpetas.
- Historia clinica y odontograma pertenecen a `patients`.
