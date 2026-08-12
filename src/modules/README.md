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
agenda/       Citas, doctores, asistentes, horarios y bloqueos
inventario/   Productos, categorias, stock, entradas y movimientos
ventas/       POS, pagos, caja, cortes, gastos y reportes financieros
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

## Modelo DEV2

Estas colecciones son la fuente de verdad del sprint DEV2. No crear colecciones paralelas con nombres similares si el concepto ya esta cubierto.

```txt
inventarioProductos      Productos, stock actual, costo, precio, categoria y clasificacion.
inventarioCategorias     Catalogo de categorias de inventario.
inventarioEntradas       Reabastecimientos por proveedor/documento/lote.
inventarioMovimientos    Historial inmutable de entradas, ventas, uso clinico, devoluciones, mermas, caducidad y ajustes.

cortesCaja               Aperturas y cierres de caja/turno.
cajaMovimientos          Ingresos, egresos, gastos operativos y fondo inicial asociados al corte.
pagos                    Transacciones economicas: ventas, tratamientos, abonos y pagos manuales.
tratamientos             Ingresos/tratamientos clinicos vinculados a paciente, cita, cotizacion o pago.
```

Equivalencias de tickets:

```txt
movimientosStock -> inventarioMovimientos
Turnos           -> cortesCaja
Ventas           -> pagos + cajaMovimientos + inventarioMovimientos cuando hay productos
Gastos           -> cajaMovimientos con tipo "egreso"
```

Reglas de modelo:

- Un cambio de stock siempre debe crear un documento en `inventarioMovimientos`.
- Una venta o cobro siempre debe crear `pagos` y su reflejo contable en `cajaMovimientos`.
- Un gasto operativo vive como `cajaMovimientos` tipo `egreso`; no crear coleccion `gastos` aparte.
- Un corte se calcula desde `cajaMovimientos`; no duplicar totales en otra coleccion salvo campos de cierre congelados en `cortesCaja`.
- Los movimientos de inventario son historicos: no se editan ni eliminan desde cliente.
- Los recibos y reportes se generan desde las colecciones oficiales, no desde copias locales.
