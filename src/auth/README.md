# Auth, roles y permisos - ClauDent

Esta carpeta contendrá la lógica relacionada con autenticación, roles y permisos.

## Objetivo

Centralizar la lógica de permisos para que módulos como Agenda, Inventario, Ventas, Pacientes, Servicios y Cotizaciones puedan mostrar u ocultar funcionalidades según el usuario.

## Estructura

```txt
guards/      Protección de rutas o acciones
hooks/       Hooks como usePermissions o useCurrentUserRole
services/    Servicios para roles, permisos y usuarios
store/       Contextos o estado de autenticación/permisos
types/       Tipos TypeScript relacionados con permisos
index.ts     Exportaciones públicas

Regla importante

Los permisos son transversales al sistema. No deben vivir dentro de Agenda, Inventario o Ventas.

---

Regla importante

Solo debe agregarse aquí código que realmente sea usado por más de un módulo.

No mover componentes existentes durante esta fase.


