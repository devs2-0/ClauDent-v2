# Fase crítica de permisos, dashboard y ajustes visuales

Rama: refactor-ui. Cambios locales: sin push, sin despliegue de reglas, sin migraciones y sin escrituras en datos reales.

## 1. Archivos modificados y agregados

- [docs/fase-critica-permisos.md](../docs/fase-critica-permisos.md)
- [firestore.rules](../firestore.rules)
- [src/app/layouts/ProtectedLayout.tsx](../src/app/layouts/ProtectedLayout.tsx)
- [src/app/navigation/navigationItems.ts](../src/app/navigation/navigationItems.ts)
- [src/app/router/AppRouter.tsx](../src/app/router/AppRouter.tsx)
- [src/app/router/routeConfig.tsx](../src/app/router/routeConfig.tsx)
- [src/auth/constants/defaultRoles.ts](../src/auth/constants/defaultRoles.ts)
- [src/auth/constants/permissionCatalog.ts](../src/auth/constants/permissionCatalog.ts)
- [src/auth/constants/permissionDependencies.ts](../src/auth/constants/permissionDependencies.ts)
- [src/auth/guards/ProtectedRouteByPermission.tsx](../src/auth/guards/ProtectedRouteByPermission.tsx)
- [src/auth/hooks/useCan.ts](../src/auth/hooks/useCan.ts)
- [src/auth/pages/RolesPage.tsx](../src/auth/pages/RolesPage.tsx)
- [src/auth/services/permissionService.ts](../src/auth/services/permissionService.ts)
- [src/auth/types/permission.types.ts](../src/auth/types/permission.types.ts)
- [src/index.css](../src/index.css)
- [src/modules/agenda/components/AppointmentManager.tsx](../src/modules/agenda/components/AppointmentManager.tsx)
- [src/modules/agenda/components/AvailabilityManager.tsx](../src/modules/agenda/components/AvailabilityManager.tsx)
- [src/modules/agenda/components/DailyCalendarView.tsx](../src/modules/agenda/components/DailyCalendarView.tsx)
- [src/modules/agenda/pages/AgendaPage.tsx](../src/modules/agenda/pages/AgendaPage.tsx)
- [src/modules/dashboard/pages/DashboardPage.tsx](../src/modules/dashboard/pages/DashboardPage.tsx)
- [src/modules/inventario/pages/InventarioPage.tsx](../src/modules/inventario/pages/InventarioPage.tsx)
- [src/modules/inventario/store/InventoryProvider.tsx](../src/modules/inventario/store/InventoryProvider.tsx)
- [src/modules/packages/components/ServiciosPaquetes.tsx](../src/modules/packages/components/ServiciosPaquetes.tsx)
- [src/modules/packages/store/PackagesProvider.tsx](../src/modules/packages/store/PackagesProvider.tsx)
- [src/modules/patients/components/InitialHistoryModal.tsx](../src/modules/patients/components/InitialHistoryModal.tsx)
- [src/modules/patients/components/PatientAntecedentes.tsx](../src/modules/patients/components/PatientAntecedentes.tsx)
- [src/modules/patients/components/PatientData.tsx](../src/modules/patients/components/PatientData.tsx)
- [src/modules/patients/components/PatientHistory.tsx](../src/modules/patients/components/PatientHistory.tsx)
- [src/modules/patients/components/PatientOdontogram.tsx](../src/modules/patients/components/PatientOdontogram.tsx)
- [src/modules/patients/components/PatientPayments.tsx](../src/modules/patients/components/PatientPayments.tsx)
- [src/modules/patients/components/PatientQuotations.tsx](../src/modules/patients/components/PatientQuotations.tsx)
- [src/modules/patients/hooks/usePatientClinicalHistoryStatuses.ts](../src/modules/patients/hooks/usePatientClinicalHistoryStatuses.ts)
- [src/modules/patients/pages/OdontogramEditorPage.tsx](../src/modules/patients/pages/OdontogramEditorPage.tsx)
- [src/modules/patients/pages/PatientRecordPage.tsx](../src/modules/patients/pages/PatientRecordPage.tsx)
- [src/modules/patients/pages/PatientsPage.tsx](../src/modules/patients/pages/PatientsPage.tsx)
- [src/modules/patients/store/PatientsProvider.tsx](../src/modules/patients/store/PatientsProvider.tsx)
- [src/modules/quotations/pages/QuotationsPage.tsx](../src/modules/quotations/pages/QuotationsPage.tsx)
- [src/modules/quotations/store/QuotationsProvider.tsx](../src/modules/quotations/store/QuotationsProvider.tsx)
- [src/modules/services/components/ServiciosIndividuales.tsx](../src/modules/services/components/ServiciosIndividuales.tsx)
- [src/modules/services/pages/ServicesPage.tsx](../src/modules/services/pages/ServicesPage.tsx)
- [src/modules/services/store/DentalServicesProvider.tsx](../src/modules/services/store/DentalServicesProvider.tsx)
- [src/modules/ventas/pages/VentasPage.tsx](../src/modules/ventas/pages/VentasPage.tsx)
- [src/modules/ventas/services/accountsReceivableService.ts](../src/modules/ventas/services/accountsReceivableService.ts)
- [src/modules/ventas/services/cashService.ts](../src/modules/ventas/services/cashService.ts)
- [src/modules/ventas/services/cashShiftSettingsService.ts](../src/modules/ventas/services/cashShiftSettingsService.ts)
- [src/modules/ventas/store/CashProvider.tsx](../src/modules/ventas/store/CashProvider.tsx)
- [src/shared/components/layout/AppSidebar.tsx](../src/shared/components/layout/AppSidebar.tsx)
- [src/shared/components/layout/BottomNav.tsx](../src/shared/components/layout/BottomNav.tsx)
- [src/shared/components/ui/sidebar.tsx](../src/shared/components/ui/sidebar.tsx)
- [tests/firestore-permissions.test.mjs](../tests/firestore-permissions.test.mjs)
- [tests/permissions.test.mjs](../tests/permissions.test.mjs)

## 2. Cambios visuales

- Tema claro: fondos aqua/gris verdoso, superficies suaves, bordes discretos y color primario más oscuro para contraste. Los tokens del tema oscuro se conservaron.
- Servicios y Paquetes: altura ajustada al viewport, contenedores flex con min-h-0, scroll vertical interno y encabezados sticky. Se eliminó el segundo contenedor de scroll que impedía fijar los encabezados.
- Agenda: calendario aislado en su propio contexto de apilamiento. Sus encabezados usan niveles 1–2; sidebar 30, encabezado/navegación 40 y portales 50.
- Títulos de módulos uniformes de 24 px; se conservaron textos Editar con capitalización normal.
- Roles: subgrupos visibles; permisos apagados cuando no están seleccionados, hijos deshabilitados hasta activar sus vistas y explicación con etiquetas legibles. Las marcas Sensible permanecen.

## 3. Cambios de permisos

- La comprobación central exige tanto el permiso solicitado como sus vistas previas. Una vista nunca añade permisos de escritura.
- Rutas y navegación aceptan vistas alternativas para Servicios/Paquetes y Administración. Administración conserva su posición inferior.
- Pacientes: listado, botones, acciones por lote, guardado y baja lógica protegidos. Ficha exige una vista propia; antecedentes, procedimientos, odontograma, pagos y cotizaciones se montan únicamente con autorización.
- Se protegen también los accesos a ficha desde el buscador global y los modales abiertos por parámetros de URL.
- Los accesos rápidos del Dashboard requieren vista y acción. Los tres resúmenes permanecen y muestran Información no disponible cuando corresponde. La agenda del Dashboard respeta el alcance de doctores/asistentes aplicado por la pantalla de Agenda.
- Historial ya no exige un proveedor de Inventario para consultarse. Pagos puede consultar los pagos del paciente sin montar Caja y conserva el comportamiento de pagos históricos por nombre para usuarios con proveedor de Caja.
- Se capturan errores de listeners y se normalizan arrays ausentes. Se corrigieron referencias erróneas al paciente y al producto en los formularios de pagos/materiales.
- Inventario y Ventas recibieron validaciones puntuales de acciones visibles y guardado; no se reescribieron sus flujos.

## 4. Permisos nuevos

| Permiso interno | Etiqueta visible |
| --- | --- |
| patients.record.view | Ver ficha del paciente |
| patients.procedures.view | Ver historial de procedimientos |
| patients.procedures.create | Crear procedimientos |
| patients.procedures.update | Editar procedimientos |
| patients.procedures.delete | Eliminar procedimientos |
| patients.payments.view | Ver pagos del paciente |
| patients.quotations.view | Ver cotizaciones del paciente |
| agenda.doctors.view | Ver doctores |
| agenda.assistants.view | Ver asistentes |
| agenda.availability.view | Ver disponibilidad |

Se reutilizan los permisos existentes de servicios, paquetes, historia clínica, odontograma, adjuntos y gestión de pagos. No se muestran claves internas en Roles. Los roles predeterminados del código incorporan las vistas y acciones clínicas correspondientes; los documentos existentes no fueron actualizados automáticamente.

## 5. Firestore rules

La estructura existente ya almacena concesiones efectivas en usuarios.permissions, calculadas a partir de roles. Se mantuvieron esas colecciones y ese mecanismo.

- Helpers para exigir permisos completos y para agrupar alternativas de lectura. Evitan superar el límite de evaluaciones en consultas financieras.
- Pacientes, servicios, paquetes y cotizaciones: read/create/update/delete separados. Consultar no autoriza mutaciones.
- Subcolecciones de procedimientos, historia clínica, odontograma y adjuntos: permisos específicos y vistas de ficha. La creación de antecedentes puede actualizar únicamente hasHistorial; eliminar pacientes mediante baja lógica únicamente estado.
- Se conservan las lecturas de catálogos que requieren cotizaciones, ventas, composición de paquetes y creación/edición de citas.
- Pagos y cuentas por cobrar admiten la nueva consulta del paciente sin conceder escrituras ni acceso a cortes de caja.
- Citas: crear, editar y cancelar separados. Cancelar solo permite estado y los campos de auditoría existentes. Bloqueos: crear y eliminar separados; la cancelación existente conserva su forma de baja lógica.
- Horarios: gestión según tipo de personal. Gestionar doctores no autoriza horarios de asistentes. Los permisos de gestión ya no conceden bloqueos implícitamente.
- Historial/notificaciones de agenda: su creación requiere una acción de agenda autorizada, no basta con ver.
- Excepción limitada para ventas: puede crear el procedimiento automático y liquidar la cotización únicamente junto con un pago nuevo, activo, vinculado al paciente y creado en la misma transacción. El cambio en la cotización se limita a los campos de cobro existentes. No permite reutilizar pagos para nuevas entradas clínicas ni editar libremente cotizaciones.
- Se reconoce la baja lógica existente de productos únicamente con Eliminar productos y los campos estado/updatedAt.
- Un administrador puede actualizar nombre, descripción, apariencia y permisos de roles de sistema existentes; no puede alterar isSystem, isAdmin o desactivarlos mediante esa excepción. Esto permite asignar las nuevas vistas sin recrear roles.
- No se modificaron las reglas de login/invitaciones/sesiones ni el esquema de almacenamiento.

## 6. Separación por módulos

| Módulo | Subgrupos principales |
| --- | --- |
| Dashboard | Vista; accesos rápidos según permiso de la acción destino |
| Pacientes | Listado, ficha, historia clínica, procedimientos, pagos, cotizaciones, odontograma, adjuntos |
| Agenda | Agenda general/citas, doctores, asistentes, bloqueos/disponibilidad, cambios, notificaciones |
| Servicios | Servicios individuales y Paquetes, independientes |
| Cotizaciones | Vista, creación, edición, eliminación, PDF |
| Ventas y caja | Ventas, pagos, apertura/cierre, cortes, gastos, reportes |
| Inventario | Catálogo, uso, stock, costos, compras |
| Administración / Seguridad | Usuarios, roles, sesiones, bitácora, configuración |
| Reportes | Vista y exportación |

La vista de agenda existente se reutiliza para calendario y citas. Los horarios y asignaciones existentes se mantienen bajo Gestionar doctores/Gestionar asistentes; no se añadieron permisos duplicados para esas operaciones.

## 7. Verificación

- node tests/permissions.test.mjs: 8 escenarios aprobados. Render de componentes reales con autenticación y datos ficticios; cubre A–F, dependencias, rutas y ausencia de proveedores opcionales.
- node tests/firestore-permissions.test.mjs: 18 escenarios aprobados con el emulador oficial de Firestore 1.22.0, proyecto demo-claudent-permissions y datos ficticios. Incluye concesiones positivas, denegaciones, protección del perfil, roles de sistema y la transacción de cobro.
- git diff --check: sin errores.
- npm run build: aprobado (salida 0, 24.15 s). Advertencias no bloqueantes: bundle mayor de 500 kB, Browserslist desactualizado y aviso experimental de Node.
- La comprobación adicional de TypeScript mantiene dos errores preexistentes en src/auth/services/sessionService.ts sobre NavigatorUAData/navigator.userAgentData. Vite realiza la compilación de producción por separado.

Para reproducir las pruebas de reglas se necesita instalar @firebase/rules-unit-testing en .tmp/testing e iniciar Firestore Emulator en 127.0.0.1:8088 con el proyecto demo-claudent-permissions. El script solo usa ese emulador y limpia exclusivamente su conjunto de pruebas. No apunta a la base real.

## 8. Limitaciones pendientes

- Las reglas permanecen locales: hasta desplegarlas por el procedimiento del proyecto, la base remota conserva sus reglas anteriores.
- Las nuevas vistas requieren asignación explícita por un administrador a los roles existentes. No hay concesiones automáticas desde Ver pacientes ni migraciones. Al editar un rol con dependencias faltantes, la pantalla solicita corregirlas antes de guardar.
- La ficha general y el listado comparten el documento pacientes. Firestore no permite ocultar campos concretos de un documento que ya puede leerse; el permiso de ficha protege la ruta/UI, mientras las subcolecciones clínicas tienen protección propia. Las lecturas de catálogos siguen disponibles para los flujos operativos que las necesitan. Referencia: [Control de campos en Firestore](https://firebase.google.com/docs/firestore/security/rules-fields).
- El alcance por doctor/asistente se filtra en las pantallas actuales. La lectura de citas en reglas sigue siendo por módulo; convertirla en seguridad por documento exige consultas filtradas y revisar las asignaciones existentes. No se hizo esa migración.
- Pagos antiguos sin pacienteId se conservan visibles mediante la ruta existente de Caja para roles financieros. La nueva vista de pagos sin Caja consulta por pacienteId.
- Registrar materiales desde un procedimiento conserva el flujo existente de crear la entrada y después actualizar sus materiales; requiere además Editar procedimientos y Registrar uso de producto. La consulta del historial no exige Inventario.
- Browser no ofreció navegadores disponibles. Se revisó el CSS y el render de componentes, pero quedan pendientes la comprobación visual interactiva de scroll/sticky, menús sobre el calendario y ambos temas con cuentas reales. No se simularon resultados visuales ni se accedió a sesiones reales.
