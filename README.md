# DentalApp - Sistema de Historial Clínico y Cotizaciones

Sistema integral de gestión para consultorios dentales con historial clínico, odontograma interactivo y generación de cotizaciones.

## Cambios documentados

- [Inicio de sesión y ayuda contextual de interfaz](docs/2026-09-05-login-y-ayuda-de-interfaz.md)

## 🦷 Características

### Módulos Implementados

- **RF01 - Login**: Autenticación simple (simulada)
- **RF02-RF05 - Gestión de Pacientes**: CRUD completo con búsqueda y filtros
- **RF03 - Historial Clínico**: Registro de servicios aplicados con cálculo de totales
- **RF06 - Odontograma Interactivo**: Visualización y edición de estados dentales (32 dientes)
- **RF08 - Catálogo de Servicios**: Gestión de servicios con precios y categorías
- **RF09 - Cotizaciones**: Constructor de cotizaciones con descuentos y exportación PDF (simulada)
- **RF10 - Buscador Global**: Búsqueda de pacientes desde el topbar
- **RF11 - Dashboard**: Estadísticas y accesos rápidos

### Características Técnicas

- ✅ React 18 + TypeScript
- ✅ Vite para desarrollo rápido
- ✅ TailwindCSS con paleta pastel personalizada
- ✅ Componentes shadcn/ui
- ✅ Iconos lucide-react
- ✅ Animaciones framer-motion
- ✅ React Router DOM v6
- ✅ Estado global con Context API
- ✅ Accesibilidad WCAG AA
- ✅ Responsive design

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <repo-url>

# Navegar al directorio
cd dentalapp

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El sistema estará disponible en `http://localhost:8080`

## 📖 Uso

### 1. Login
- Ingresa cualquier nombre de usuario para acceder (no requiere contraseña)
- Se redirigirá automáticamente al dashboard

### 2. Dashboard
- Vista general de estadísticas
- Accesos rápidos a módulos principales
- Pacientes recientes

### 3. Gestión de Pacientes
- **Crear**: Click en "Nuevo Paciente"
- **Editar**: Click en el ícono de lápiz en la tabla
- **Eliminar**: Click en el ícono de papelera
- **Buscar**: Usa el campo de búsqueda o el buscador global
- **Filtrar**: Por estado (activo/inactivo)
- **Abrir Ficha**: Click en el ícono de ojo o en el nombre

### 4. Ficha de Paciente (Tabs)

#### Datos
- Editar información personal del paciente
- Cambiar estado (activo/inactivo)

#### Historial Clínico
- Agregar nuevas entradas con servicios aplicados
- Ver histórico de tratamientos
- Cálculo automático de totales

#### Adjuntos
- Subir archivos (simulado, no persiste)
- Ver y eliminar adjuntos

#### Odontograma
- Click en cada diente para cambiar su estado
- Estados: sano, cariado, tratado, ausente
- Leyenda con código de colores
- Guardado en estado local

#### Cotizaciones
- Ver cotizaciones del paciente
- Link a módulo principal de cotizaciones

### 5. Servicios
- Catálogo completo de servicios dentales
- Crear, editar y eliminar servicios
- Búsqueda por nombre, código o categoría

### 6. Cotizaciones
- Crear nueva cotización seleccionando paciente
- Agregar múltiples servicios con cantidades
- Aplicar descuentos porcentuales
- Ver totales y subtotales
- Exportar a PDF (simulado - genera blob vacío)

## 🎨 Diseño

### Paleta de Colores (Pastel)
- **Primary**: Sky blue (#7DD3FC) - Acciones principales
- **Secondary**: Emerald green (#86EFAC) - Estados positivos
- **Accent**: Warm sand (#FDE68A) - Fondos y elementos secundarios
- **Success**: Green - Confirmaciones
- **Destructive**: Red pastel - Eliminaciones

### Tipografía
- Sans-serif del sistema
- Jerarquía clara con tamaños bien definidos
- Contraste suficiente (WCAG AA)

### Accesibilidad
- Navegación por teclado completa
- Focus visible en todos los elementos interactivos
- Roles y labels ARIA
- Contrastes de color apropiados

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── ui/             # shadcn/ui components
│   ├── Layout.tsx      # Layout principal con topnav y sidebar
│   ├── Patient*.tsx    # Componentes de ficha de paciente
│   └── NavLink.tsx     # NavLink wrapper
├── pages/              # Páginas principales
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Pacientes.tsx
│   ├── FichaPaciente.tsx
│   ├── Servicios.tsx
│   ├── Cotizaciones.tsx
│   └── NotFound.tsx
├── state/              # Estado global
│   └── AppContext.tsx  # Context API con datos demo
├── lib/                # Utilidades
│   └── utils.ts        # Helpers (edad, currency, fechas, RUT)
├── App.tsx             # Router y rutas protegidas
└── main.tsx            # Entry point
```

## ⚠️ Limitaciones (By Design)

1. **Sin Backend**: Todos los datos están en memoria (se pierden al recargar)
2. **Sin Validaciones**: Formularios básicos sin validación exhaustiva
3. **PDF Simulado**: Export genera blob vacío
4. **Autenticación Mock**: Login sin verificación real
5. **Archivos No Persisten**: Adjuntos usan blob URLs temporales

## 🔧 Stack Tecnológico

- **React** 18.3.1
- **TypeScript** 5.x
- **Vite** 6.x
- **TailwindCSS** 3.x
- **shadcn/ui** - Componentes UI
- **Framer Motion** - Animaciones
- **Lucide React** - Iconos
- **React Router DOM** 6.x

## 📝 Notas de Desarrollo

- Todos los colores usan HSL en `index.css`
- Sistema de diseño centralizado en `tailwind.config.ts`
- Estado local para simular persistencia
- Datos demo incluidos para pruebas rápidas
- Sin llamadas HTTP ni APIs externas

## 🎯 Próximos Pasos (Fuera del Alcance)

- Integrar backend real (Supabase/Firebase)
- Validaciones con Zod/Yup
- Generación real de PDFs (jsPDF/react-pdf)
- Sistema de autenticación robusto
- Persistencia de archivos en cloud storage
- Tests unitarios y E2E
- Calendario de citas
- Reportes y analytics

## 📄 Licencia

Este proyecto es un prototipo de validación UI/UX sin backend.

---

**Desarrollado con ❤️ para consultorios dentales modernos**
