# Shared - ClauDent

Esta carpeta contiene codigo reutilizable entre dominios.

## Estructura

```txt
components/ui/       Componentes shadcn reutilizables
components/layout/   Navegacion y piezas de layout compartidas
components/feedback/ Espacio para feedback global
components/forms/    Espacio para formularios compartidos
constants/           Constantes globales
hooks/               Hooks reutilizables
services/            Servicios transversales
types/               Tipos compartidos
utils/               Utilidades generales
index.ts             Exportaciones publicas compartidas
```

## Reglas

- UI reutilizable va en `shared/components/ui`.
- Utilidades generales van en `shared/utils`.
- Si un archivo solo pertenece a un dominio, debe vivir en su modulo, no en `shared`.
