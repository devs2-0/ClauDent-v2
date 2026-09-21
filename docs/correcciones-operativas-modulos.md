ClauDent v2 — Correcciones operativas

Rama: `feature/correcciones-operativas-modulos`. Cambios locales; sin commit, push, despliegues ni operaciones contra datos de producción.

1. Archivos modificados o añadidos

- `docs/correcciones-operativas-modulos.md`
- `scripts/verify-operational.mjs`
- `src/app/components/GlobalNotificationsButton.tsx`
- `src/auth/pages/RolesPage.tsx`
- `src/auth/pages/UsersPage.tsx`
- `src/auth/services/roleService.ts`
- `src/auth/services/userInvitationService.ts`
- `src/auth/services/userService.ts`
- `src/auth/types/role.types.ts`
- `src/auth/types/user.types.ts`
- `src/auth/utils/roleLifetime.ts`
- `src/modules/agenda/components/AppointmentManager.tsx`
- `src/modules/agenda/components/DailyCalendarView.tsx`
- `src/modules/patients/components/InitialHistoryModal.tsx`
- `src/modules/patients/components/PatientAntecedentes.tsx`
- `src/modules/patients/components/PatientHistory.tsx`
- `src/modules/patients/components/PatientInactivitySettings.tsx`
- `src/modules/patients/components/forms/FormApnp.tsx`
- `src/modules/patients/hooks/usePatientClinicalActivity.ts`
- `src/modules/patients/hooks/usePatientClinicalHistoryStatuses.ts`
- `src/modules/patients/hooks/usePatientInactivitySettings.ts`
- `src/modules/patients/pages/PatientRecordPage.tsx`
- `src/modules/patients/pages/PatientsPage.tsx`
- `src/modules/patients/store/PatientsProvider.tsx`
- `src/modules/patients/types/clinicalHistory.types.ts`
- `src/modules/patients/utils/clinicalFieldLabels.ts`
- `src/modules/patients/utils/clinicalHistoryForm.ts`
- `src/modules/patients/utils/patientAlerts.ts`
- `src/modules/patients/utils/patientUi.ts`
- `src/modules/services/components/ServiciosIndividuales.tsx`
- `src/modules/services/store/DentalServicesProvider.tsx`
- `src/modules/services/utils/categories.ts`
- `src/shared/hooks/useModalDraft.ts`
- `src/shared/utils/duration.ts`
- `src/shared/utils/modalDraft.ts`
- `tests/firestoreStub.ts`
- `tests/operational.test.ts`

2. Servicios

Buscador por nombre, código y categoría, insensible a acentos, mayúsculas y espacios repetidos. Filtro de categorías deduplicado a partir de los registros existentes; etiquetas con mayúscula inicial por palabra. Cuando ya existe una variante acentuada se prefiere esa etiqueta. La misma normalización se aplica al crear/editar y al generar el código. No se migraron registros.

El listado abre en activos. Eliminar conserva `estado: inactivo`, solicita confirmación, exige `services.delete` y vuelve al filtro de activos. El servicio sigue consultable en Todos/Inactivos y las referencias históricas permanecen intactas.

3. Agenda

Las cinco tarjetas de resumen del día seleccionado aparecen sobre los filtros y debajo de las pestañas. Se quitó «Pacientes del día». Día por doctores tiene barra horizontal superior sincronizada con la inferior y botones de desplazamiento desde escritorio. La vista móvil conserva su desplazamiento original; Semana/Mes mantienen sus componentes.

4. Pacientes

Eliminar desde directorio, selección múltiple o ficha usa baja lógica y conserva el expediente. También se sustituyó el borrado físico del método compartido `deletePatient`. El directorio regresa a activos y ajusta la página después de bajas.

El alta incorpora dirección opcional plegable en los mismos campos de la ficha. Las tarjetas muestran género y estado de historial, sin teléfono; el acceso al estado clínico sigue protegido por su permiso. Se reconocen nombres antiguos de secciones de historial.

El historial precarga teléfono y estado civil cuando están vacíos: son los campos equivalentes que existen en el formulario clínico actual. Los datos ya capturados se conservan y no se agregan campos personales duplicados.

«Paciente niega procedimientos» se guarda como campo opcional en historia general y también en cada entrada de procedimientos. Se puede marcar/desmarcar; una entrada de negativa puede guardarse sin servicios y no registra consumo ni actividad clínica realizada. No se permite combinar esa negativa con servicios/materiales aplicados en la misma entrada. Los historiales antiguos conservan su estructura.

Antecedentes No Patológicos incorpora auxiliares seleccionables (hilo dental, enjuague, ninguno, otros), selección múltiple compatible y texto para Otros. El texto libre anterior se conserva como Otros; también se sigue escribiendo el resumen textual existente. Cartilla y esquema completo son campos opcionales Sí/No, sin asumir respuestas de pacientes anteriores. Los campos clínicos conocidos tienen etiquetas legibles; los datos adicionales antiguos siguen visibles sin exponer sus claves.

5. Usuarios

Se corrigió la lectura de `visible` y `deletedAt`: la baja existente ya bloqueaba y ocultaba la cuenta, pero el normalizador descartaba esos campos. Ahora no reaparece al recargar. Se conservan confirmaciones, permiso de eliminación y protecciones contra quitar la propia cuenta o el último administrador activo. La asignación comprueba otra vez que los roles estén vigentes.

6. Roles

El listado principal abre en activos. Se conserva el borrado físico existente exclusivamente para roles no protegidos y sin usuarios asignados; la fila desaparece inmediatamente tras el éxito. Roles de sistema y administradores continúan protegidos. Se corrigió además el cierre del formulario tras guardar.

7. Firestore y alcance

No se modificaron `firestore.rules`, nombres de colecciones ni autenticación base. No hubo migraciones ni cambios en Ventas, Caja, Inventario o Dashboard. La única integración global está en el componente de avisos. Las bajas de servicios y pacientes escriben únicamente `estado`, compatible con los permisos de eliminación ya existentes.

8. Borradores

Se usan claves de localStorage separadas por usuario, formulario, paciente y entrada cuando corresponde. Nuevo paciente, historia clínica inicial/edición y modal de procedimientos conservan datos al cerrar con X, Escape o fuera del diálogo. Se recuperan al abrir con un aviso discreto. Cancelar y guardar eliminan el borrador. No se guarda un formulario sin cambios respecto a su estado inicial o precargado; al leer, un borrador de más de siete días se descarta. Si el almacenamiento falla, se mantiene una copia durante la sesión y se informa mediante toast.

Una entrada de procedimientos que ya se guardó no se conserva como borrador nuevo si después falla el registro de materiales, para evitar duplicarla al recuperar. No se cambiaron los servicios de inventario ni sus reglas.

9. Roles temporales

El formulario permite número entero positivo y minutos/horas/días/semanas/meses/años. Persiste `temporary`, `durationValue`, `durationUnit` y `expiresAt` en el mismo documento del rol. La duración comienza al guardar; guardar una nueva duración renueva el vencimiento, y un rol que ya esté inactivo se activa explícitamente después.

Toda lectura/listado normaliza un rol vencido como inactivo. La asignación y nuevas invitaciones validan roles activos y vigentes. Los roles de sistema/administrador no pueden volverse temporales. La página de Roles comprueba el vencimiento mientras está abierta; al leer desde Roles o Usuarios con `roles.update`, archiva los vencidos y recalcula permisos de usuarios asignados, conservando los de sus otros roles. Una lectura sin permiso de modificación no escribe.

10. Alertas de pacientes

Duración predeterminada: cuatro meses naturales. La configuración permite días, semanas, meses y años, además de activar/desactivar avisos. Si había una preferencia anterior en días se conserva. Se guarda por dispositivo usando la configuración local existente y solo puede editarse con `settings.update`.

La revisión pendiente se calcula desde la fecha válida más reciente entre registro, procedimiento realizado, cita con estado `completed` y última consulta odontológica capturada en historia general (incluido su documento antiguo). Se ignoran fechas inválidas/futuras y entradas donde se negaron procedimientos. Se comparan meses/años de calendario, no aproximaciones de 30/365 días. Si no hay ninguna fecha válida no se inventa una alerta. Cada aviso indica su fuente y advierte si la información disponible es parcial por permisos o errores de lectura.

Los cumpleaños comparan día y mes en fecha local, para pacientes activos e inactivos; se omiten nacimientos vacíos, inválidos o futuros. Los nacidos el 29 de febrero se notifican el propio 29 en años bisiestos. No se muestra teléfono ni detalle clínico. Los identificadores son estables por paciente/fecha o periodo de actividad y reutilizan el estado de vistos existente (recordatorio cada 12 horas). El clic marca visto y dirige a ficha solo con permiso; en otro caso, al módulo de Pacientes. La fuente solo se monta con `patients.view`.

11. Validación

- `npm run build` ejecutado mediante `npm.cmd run build` en Windows: correcto, salida de producción generada. Avisos de paquete principal mayor de 500 kB, datos antiguos de Browserslist y Type Stripping experimental; ninguno bloquea la compilación.
- `node scripts/verify-operational.mjs`: 14 pruebas aprobadas de categorías, duraciones/calendario, alertas, negativas, precarga, borradores, configuración anterior, vencimiento de roles, permisos y protección de administradores. Los servicios usan Firestore simulado: no se accede a datos reales.
- ESLint sobre los archivos/áreas revisados: cero errores; seis advertencias de hooks/Fast Refresh en código existente (incluidas dos de PatientPayments, archivo sin cambios).
- TypeScript: solo se detectan dos errores preexistentes en `src/auth/services/sessionService.ts:45` y `:80`, por `NavigatorUAData` y `navigator.userAgentData`. Ese archivo no fue modificado.
- `git diff --check`: correcto.

12. Limitaciones y comprobaciones pendientes

La configuración y los borradores son locales al dispositivo; no se sincronizan entre equipos. El plazo de siete días se aplica al recuperar, sin proceso de limpieza en segundo plano.

No existe un backend programado para revocar roles exactamente al vencer. El rol se trata como inactivo al leerlo, pero la autenticación actual y las invitaciones conservan permisos calculados: la revocación efectiva de permisos ya persistidos depende de un recálculo autorizado. Para garantizar el vencimiento en cualquier sesión, equipo o invitación pendiente se necesita un proceso de backend y validación al consumir invitaciones; no se alteró la autenticación base ni se ampliaron reglas para simular esa garantía.

Los avisos se calculan con la aplicación abierta y con las fuentes permitidas a la cuenta. Las lecturas de historial se acotan a pacientes potencialmente vencidos; su número crece con ese grupo. No se generan notificaciones push ni correos. No hay navegador conectado en esta sesión: queda pendiente la comprobación visual en escritorio/móvil y modo claro/oscuro, así como la prueba integral contra Firebase con cuentas de permisos distintos. Las pruebas automatizadas verifican la lógica local, no sustituyen esa comprobación.
