# Correcciones finales — ClauDent v2

Fecha: 21 septiembre 2026. Rama: `feature/correcciones-operativas-modulos`.
Base: `4bf19d1`. Cambios locales; no se hizo commit, push ni despliegue de reglas. No se modificaron datos de producción.

## 1. Archivos modificados

El listado al final incluye todos los archivos de esta fase. Los cambios abarcan catálogos, las pantallas que consumen sus referencias históricas, configuración y verificaciones. No se renombraron colecciones ni se ejecutaron migraciones.

## 2. Eliminación real

- Servicios: `deleteDoc(servicios/{id})`, protegido por `services.delete`.
- Pacientes: `deleteDoc(pacientes/{id})`, protegido por `patients.delete`. No se eliminan subcolecciones ni citas, cotizaciones, ventas o procedimientos. La eliminación por lote incluye también pacientes inactivos.
- Usuarios: `deleteUserAccess` elimina `usuarios/{uid}`; conserva protección de la propia cuenta y del último administrador activo. Requiere `users.delete`. No elimina la identidad en Firebase Authentication.
- Doctores/asistentes: se elimina su documento de `doctores`/`asistentes`. Nuevos permisos específicos `agenda.doctors.delete` y `agenda.assistants.delete`; gestionar o ver no concede eliminación. Los roles existentes no reciben estos permisos automáticamente.
- Roles: se conserva la eliminación física existente de roles sin usuarios asignados. Los roles asignados, del sistema o administradores siguen protegidos.
- Categorías: se retira realmente la entrada del catálogo compartido; no se conserva como activa/inactiva ni se oculta una entrada existente.

Las acciones de eliminación utilizan la confirmación visual existente, incluyendo la conservación de referencias históricas. Desactivar sigue siendo una acción distinta de eliminar.

## 3. Referencias históricas

La agenda conserva los IDs y nombres capturados de citas anteriores y futuras. Un doctor eliminado genera una referencia gris, con nombre capturado cuando existe y etiqueta `Doctor eliminado`. Los asistentes ausentes muestran un texto equivalente. Los calendarios reciben referencias históricas separadas del catálogo de asignaciones activas, conservando el alcance del doctor/usuario/asistente autorizado.

El expediente de un paciente cuyo documento principal ya no existe abre sus secciones permitidas en modo de consulta con `Paciente eliminado`. Se conservan antecedentes, procedimientos, odontogramas, cotizaciones y pagos. Se puede llegar al expediente desde una cotización histórica. El editor de odontogramas tampoco permite guardar sobre un paciente eliminado.

Los procedimientos nuevos guardan nombre y precio del servicio; los existentes muestran su snapshot o `Servicio eliminado`. Las cotizaciones mantienen conceptos/precios capturados, identifican pacientes o servicios eliminados y pueden exportar PDF aunque falte el paciente. Las ventas mantienen sus snapshots y muestran la referencia del paciente eliminado. Los paquetes con servicios eliminados conservan su composición, pero exigen reemplazar o retirar esas referencias antes de guardar.

Las comprobaciones de agenda al guardar vuelven a consultar las referencias nuevas. Cambiar el doctor de una cita permite conservar su paciente/servicio histórico, aunque ya no exista en el catálogo. No habilita asignaciones nuevas a elementos eliminados.

## 4. Borradores de pacientes

El borrador local existente aparece como tarjeta `Borrador`, separada del conjunto de pacientes reales y de las selecciones por lote. Permite Continuar y Descartar con confirmación visual. X, Escape o clic exterior conservan lo capturado; Cancelar, descartar y guardar eliminan el borrador. Solo guardar crea el documento de paciente. Sigue aislado por UID, formulario y dispositivo; conserva la caducidad previa de siete días y el respaldo en memoria cuando localStorage no está disponible.

## 5. Inactividad automática y recordatorio

Configuraciones independientes en Pacientes:

- Inactividad automática: inicialmente 6 meses; número y unidad días/semanas/meses/años.
- Recordatorio: inicialmente 4 meses; interruptor independiente y número/unidad propios.

Los valores anteriores de días y la configuración v2 se conservan como recordatorio; se añade el periodo automático de 6 meses si faltaba. Las notificaciones usan exclusivamente el umbral del recordatorio y describen el umbral automático por separado.

El listado calcula `Inactivo por periodo` cuando se cumple el umbral automático. Usa la actividad clínica más reciente conocida (procedimientos, citas atendidas, consulta odontológica o registro), espera a que las fuentes estén cargadas y no infiere inactividad con permisos insuficientes o lecturas fallidas. No cambia el documento de paciente ni ejecuta procesos con la aplicación cerrada. La edición de datos toma el estado almacenado, sin persistir accidentalmente el estado calculado. Las preferencias siguen siendo locales a este dispositivo.

## 6. Agenda

- Resumen de fecha con formato `21 septiembre 2026`.
- Retirado el botón `Ver día seleccionado` del calendario mensual.
- Toda la celda mensual admite clic y teclado (Enter/Espacio), con foco y etiqueta accesible.
- Los botones de citas detienen la propagación para no navegar al día involuntariamente.
- Doctores eliminados e inactivos siguen visibles como referencias para las citas existentes; sus horarios no ofrecen huecos nuevos.
- Un doctor histórico nunca se precarga como asignación nueva al usar el filtro del calendario.
- Las citas futuras conservan la acción Editar para seleccionar un doctor activo.

## 7. Categorías de Servicios

Nuevo documento `configuracionModulos/servicios`, con una lista de categorías `{ id, name, legacyKeys }`. El CRUD usa transacciones para no sobrescribir cambios concurrentes. Se normalizan espacios y mayúscula inicial por palabra; las duplicidades se comparan sin acentos ni diferencias de mayúsculas.

Mientras no existe el documento, las opciones se derivan de categorías antiguas normalizadas. El primer cambio autorizado persiste esas opciones junto con la operación solicitada. Para iniciar el catálogo se exige disponer de la lectura del catálogo de servicios; si no está cargado o no hay permiso, no se importa una lista parcial.

Servicios utiliza select y filtro del catálogo configurado, con opción Sin categoría. Las nuevas asignaciones incluyen `categoriaId`; las antiguas se resuelven mediante claves heredadas. Renombrar conserva asociaciones; eliminar quita la categoría y los servicios se presentan sin categoría. Recrear el mismo nombre con otro ID no vuelve a vincular servicios de la categoría eliminada.

La desasignación se resuelve al leer: no se reescriben en masa los campos históricos `categoria`/`categoriaId` de los documentos de servicios. Esta decisión conserva datos y evita exigir `services.update` a quien administra configuración. Un consumidor externo que lea los documentos crudos debe aplicar el mismo resolutor. Agenda también resuelve el catálogo; si la configuración no puede leerse, sigue mostrando los servicios y citas sin categoría, sin bloquear la agenda.

## 8. Roles temporales

Activar un rol temporal inactivo o vencido abre el formulario con una explicación de renovación. Guardar establece estado activo y nueva duración desde ese momento, o permite desmarcar Temporal para borrar el vencimiento. El servicio rechaza duración inválida y activación vencida sin resolver vigencia. Se recalculan los permisos de usuarios asignados con el mecanismo existente. La activación por lote de temporales pide usar la activación individual para elegir duración; no activa silenciosamente roles vencidos.

## 9. Configuración por módulos

La pestaña Configuración de Administración conserva `settings.view` y ahora contiene pestañas Pacientes y Servicios. Pacientes reúne ambos periodos; Servicios reúne categorías. Las mutaciones requieren `settings.update`; usuarios sin ese permiso ven los valores pero no el CRUD de categorías. Se conservan clases semánticas para modo claro/oscuro y los diálogos visuales compartidos.

## 10. Firestore rules

Cambios mínimos, únicamente en estos tres bloques:

| Ruta | Operación | Permiso requerido |
| --- | --- | --- |
| `doctores/{doctorId}` | delete | `agenda.view` + `agenda.doctors.view` + `agenda.doctors.delete`; administrador conserva acceso mediante los helpers existentes |
| `asistentes/{assistantId}` | delete | `agenda.view` + `agenda.assistants.view` + `agenda.assistants.delete`; administrador conserva acceso mediante los helpers existentes |
| `configuracionModulos/servicios` | read | `settings.view` o los mismos lectores que ya podían consultar `servicios`: `services.view`; `packages.create/update` con su vista de módulo; `patients.procedures.view` con vistas de expediente y sección; `agenda.appointments.create/update` con `agenda.view`; `quotations.view`; `sales.view` |
| `configuracionModulos/servicios` | create/update | `settings.view` + `settings.update`, documento con únicamente `categories` de tipo lista |

No se concede delete del documento completo de configuración; eliminar una categoría actualiza su lista. No se abren otros documentos bajo `configuracionModulos`. No se cambian las reglas de servicios, pacientes, usuarios, roles o historiales: ya tenían permisos de eliminación física apropiados para sus documentos principales. No se desplegaron estas reglas; deben publicarse junto con la aplicación antes de usar el catálogo compartido y los permisos nuevos.

## 11. Verificación

- `npm.cmd run build` (equivalente a `npm run build` en PowerShell): correcto, Vite 7.3.6, 2889 módulos, 12.06 s.
- `node scripts/verify-operational.mjs`: 21/21 pruebas aprobadas. Incluye categorías/renombrado/eliminación, 4 frente a 6 meses, borradores aislados, conservación de citas, restricción de alcance, renovación de roles, borrado de usuarios/personal y selección obsoleta de referencias.
- ESLint sobre archivos TypeScript modificados y nuevos: 0 errores, 6 advertencias previas (dependencias de hooks/fast refresh).
- `git diff --check`: correcto.
- TypeScript independiente: solo permanecen los errores previos de `NavigatorUAData` y `navigator.userAgentData` en `src/auth/services/sessionService.ts:45,80`. El build de Vite no ejecuta ese chequeo de tipos.
- Build conserva avisos de tamaño del bundle, Browserslist desactualizado y Type Stripping experimental.

Las pruebas de servicios utilizan Firestore simulado, sin red ni datos reales. No sustituyen pruebas de reglas con Firebase Emulator Suite.

## 12. Pendientes y limitaciones

- Verificación visual autenticada pendiente: el navegador disponible para automatización informó `No browser is available`. No se validaron clics reales, disposición móvil ni temas con una sesión autenticada.
- Reglas nuevas preparadas pero no desplegadas; revisar su comportamiento en emulador antes de publicarlas. Asignar expresamente los nuevos permisos de eliminación de personal a los roles no administradores que deban utilizarlos.
- La inactividad se calcula en el listado con fuentes completas y permisos suficientes; no existe cron/backend ni cambio global persistente del estado. Otras pantallas siguen usando el estado almacenado.
- La eliminación de usuario quita su perfil y permisos de aplicación, pero conserva su identidad Firebase Auth y registros históricos de sesiones. Eliminar identidades de terceros requiere un backend con Admin SDK.
- No se migraron antiguas bajas lógicas ni registros sin snapshots. Cuando falta el documento y no había nombre capturado, se utiliza la etiqueta de eliminado.
- Los roles asignados deben desasignarse antes de eliminarse; se mantienen todas las protecciones de sistema/administrador.
- Las categorías eliminadas se desasocian mediante el resolutor, sin borrar masivamente los valores heredados almacenados en servicios.

## Inventario de archivos de esta fase

- `firestore.rules`
- `src/app/components/GlobalNotificationsButton.tsx`
- `src/auth/constants/permissionCatalog.ts`
- `src/auth/constants/permissionDependencies.ts`
- `src/auth/pages/AdminPanelPage.tsx`
- `src/auth/pages/RolesPage.tsx`
- `src/auth/pages/UsersPage.tsx`
- `src/auth/services/userInvitationService.ts`
- `src/auth/types/permission.types.ts`
- `src/modules/agenda/components/AgendaHistoryPanel.tsx`
- `src/modules/agenda/components/AppointmentDetailsDialog.tsx`
- `src/modules/agenda/components/AppointmentDialog.tsx`
- `src/modules/agenda/components/AppointmentManager.tsx`
- `src/modules/agenda/components/AvailabilityManager.tsx`
- `src/modules/agenda/components/DailyCalendarView.tsx`
- `src/modules/agenda/components/MonthlyCalendarView.tsx`
- `src/modules/agenda/components/WeeklyCalendarView.tsx`
- `src/modules/agenda/pages/AgendaPage.tsx`
- `src/modules/agenda/services/agendaHistoryService.ts`
- `src/modules/agenda/services/appointmentReferences.ts`
- `src/modules/agenda/services/appointmentService.ts`
- `src/modules/agenda/services/assistantService.ts`
- `src/modules/agenda/services/doctorService.ts`
- `src/modules/agenda/services/serviceLookupService.ts`
- `src/modules/agenda/types/agenda.types.ts`
- `src/modules/agenda/utils/historicalDoctors.ts`
- `src/modules/packages/components/ServiciosPaquetes.tsx`
- `src/modules/patients/components/PatientAntecedentes.tsx`
- `src/modules/patients/components/PatientHistory.tsx`
- `src/modules/patients/components/PatientInactivitySettings.tsx`
- `src/modules/patients/components/PatientOdontogram.tsx`
- `src/modules/patients/components/PatientPayments.tsx`
- `src/modules/patients/components/PatientQuotations.tsx`
- `src/modules/patients/hooks/useEffectivePatientStatus.ts`
- `src/modules/patients/hooks/usePatientClinicalActivity.ts`
- `src/modules/patients/hooks/usePatientInactivitySettings.ts`
- `src/modules/patients/pages/OdontogramEditorPage.tsx`
- `src/modules/patients/pages/PatientRecordPage.tsx`
- `src/modules/patients/pages/PatientsPage.tsx`
- `src/modules/patients/store/PatientsProvider.tsx`
- `src/modules/patients/types/clinicalHistory.types.ts`
- `src/modules/quotations/pages/QuotationsPage.tsx`
- `src/modules/quotations/services/quotationPdfService.ts`
- `src/modules/quotations/types/quotation.types.ts`
- `src/modules/services/components/ServiceCategorySettings.tsx`
- `src/modules/services/components/ServiciosIndividuales.tsx`
- `src/modules/services/hooks/useServiceCategoryCatalog.ts`
- `src/modules/services/store/DentalServicesProvider.tsx`
- `src/modules/services/types/service.types.ts`
- `src/modules/services/utils/categoryCatalog.ts`
- `src/modules/ventas/pages/VentasPage.tsx`
- `tests/firestoreStub.ts`
- `tests/operational.test.ts`
- `docs/correcciones-finales-modulos.md` (este informe)
