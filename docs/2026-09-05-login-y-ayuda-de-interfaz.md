# Inicio de sesión y ayuda contextual de interfaz

Fecha: 5 de septiembre de 2026

## Objetivo

Mejorar la experiencia de inicio de sesión y reducir el texto explicativo permanente en los módulos operativos, sin alterar las reglas de negocio ni los permisos existentes.

## Inicio de sesión

- El botón de inicio de sesión muestra un indicador de carga y el texto `Iniciando sesión...` mientras Firebase valida las credenciales.
- Durante la validación se bloquean los campos, enlaces y controles del formulario para evitar intentos o navegación duplicados.
- La navegación al dashboard ahora ocurre cuando el estado de autenticación global confirma la sesión, no inmediatamente después de la respuesta de Firebase Auth.
- Las rutas públicas también esperan la resolución inicial de Firebase y muestran `Comprobando sesión...`; esto evita que la aplicación redirija temporalmente al formulario de acceso después de iniciar sesión.

## Ayuda contextual

Se añadió el componente reutilizable `SectionHelp`.

- Muestra un icono `?` compacto junto al encabezado o control correspondiente.
- Al pasar el cursor muestra la pista `¿Para qué sirve esta sección?`.
- Al pulsarlo abre un diálogo adaptable con explicación y cierre por botón `X`, tecla Escape o clic fuera.

Se movieron las descripciones generales de los siguientes módulos a esta ayuda contextual:

- Caja y configuración de turnos.
- Ventas.
- Inventario.
- Agenda.
- Seguridad de acceso.
- Bitácora.
- Cotizaciones.
- Servicios y paquetes.
- Panel de administración, usuarios y roles.

Los mensajes operativos que previenen errores —por ejemplo, caja cerrada, permisos insuficientes o instrucciones dentro de formularios— se conservaron visibles.

## Limpieza de Caja

- Se eliminó la franja permanente `Flujo separado` de Caja.
- Su explicación se integró al icono de ayuda principal de Caja.
- `Pendientes de cobro` permanece accesible desde su pestaña dentro de Caja, sin duplicar el acceso en pantalla.

## Validación realizada

```bash
npm run build
npm run lint
```

La compilación finaliza correctamente. El linter no reporta errores; conserva advertencias preexistentes de Fast Refresh y una dependencia de `useEffect` en `AvailabilityManager` que no pertenecen a este cambio.
