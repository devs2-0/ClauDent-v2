# Reglas de arquitectura para módulos - ClauDent

Esta carpeta contiene los nuevos módulos funcionales del sistema:

* Agenda
* Inventario
* Ventas

Cada módulo debe vivir dentro de su propia carpeta en `src/modules`.

## Regla principal

Todo el código nuevo de Agenda, Inventario y Ventas debe crearse dentro de su módulo correspondiente.

Ejemplo:

```txt
src/modules/agenda/
src/modules/inventario/
src/modules/ventas/
```

## Estructura interna de cada módulo

Cada módulo debe mantener esta estructura:

```txt
components/   Componentes visuales internos del módulo
pages/        Pantallas completas conectables al router
hooks/        Hooks propios del módulo
services/     Funciones de lectura, escritura o lógica externa
store/        Estado local, contextos o reducers del módulo
types/        Tipos e interfaces TypeScript
index.ts      Exportaciones públicas del módulo
```

## Reglas importantes

1. No agregar lógica nueva de Agenda, Inventario o Ventas en `src/state/AppContext.tsx`.
2. No mover archivos existentes de `src/pages`, `src/components`, `src/lib` o `src/state` durante esta fase.
3. Cada módulo debe manejar su propio estado, servicios y tipos.
4. Las importaciones externas deben hacerse preferentemente desde el `index.ts` del módulo.
5. No importar archivos internos profundos de otro módulo si no es necesario.
6. Los roles y permisos no pertenecen a un módulo específico. Deben vivir en `src/auth`.

## Convención de imports

Correcto:

```ts
import { AgendaPage } from "@/modules/agenda";
import { usePermissions } from "@/auth";
import { formatCurrency } from "@/shared";
```

Evitar:

```ts
import { AgendaPage } from "../../../modules/agenda/pages/AgendaPage";
```

Evitar también:

```ts
import { AgendaCalendar } from "@/modules/agenda/components/AgendaCalendar";
```

Si algo necesita usarse fuera de un módulo, debe exportarse desde el `index.ts` del módulo.

## Objetivo

Esta estructura permite que Agenda, Inventario, Ventas y Roles puedan crecer sin mezclar lógica nueva dentro de `AppContext.tsx` ni romper pacientes, servicios, cotizaciones, historial clínico u odontograma.
