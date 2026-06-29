# Auth - ClauDent

Esta carpeta contiene autenticacion, usuario actual, sesiones, roles, permisos y guards.

## Estructura

```txt
components/   Componentes transversales de permisos y roles
constants/    Catalogo fijo de permisos y roles base
guards/       Proteccion de rutas o acciones
hooks/        useAuth, usePermissions y perfil actual
pages/        Pantallas publicas de autenticacion
services/     Integracion con Firebase Auth, usuarios, roles y sesiones
store/        AuthProvider
types/        Tipos de auth, roles y permisos
index.ts      API publica del dominio auth
```

## Reglas

- Los permisos viven aqui, no dentro de cada modulo.
- Los modulos consumen permisos desde `@/auth`.
- La convencion de permisos es `modulo.recurso.accion`.
- Las rutas pueden declarar un permiso en `src/app/router/routeConfig.tsx`.
