# Feature Compartida: Solicitudes de Edición

Esta feature proporciona funcionalidad completa para manejar solicitudes de edición en todas las aplicaciones del sistema.

## Estructura

```
shared/features/solicitudes/
├── types/
│   └── solicitudesEdicion.ts     # Tipos TypeScript
├── services/
│   └── solicitudesEdicionService.ts  # API calls
├── components/
│   ├── index.ts
│   └── SolicitudEditModalSimple.tsx  # Modal básico para editar solicitudes
├── pages/
│   ├── index.ts
│   └── NotificacionesPage.tsx        # Página de notificaciones
└── index.ts                         # Exporta todo
```

## Cómo integrar en una aplicación

### 1. Instalar dependencias

Asegúrate de que tu aplicación tenga acceso a `authFetch` y React.

### 2. Importar la feature

```typescript
// En tu aplicación, importa lo que necesites
import {
  // Tipos
  SolicitudEdicion,
  SolicitudEdicionTipo,
  ISolicitudFiltros,

  // Servicios
  getSolicitudesEdicion,
  crearSolicitudEdicion,
  actualizarSolicitudEdicion,

  // Componentes
  SolicitudEditModalSimple,

  // Páginas
  NotificacionesPage,
} from '../../../shared/features/solicitudes';
```

### 3. Usar en páginas de notificaciones

```tsx
// En tu página de notificaciones (reemplaza la implementación actual)
import { NotificacionesPage } from '../../../shared/features/solicitudes';

export default function MiNotificacionesPage() {
  return <NotificacionesPage />;
}
```

### 4. Usar servicios en componentes

```tsx
import { getSolicitudesEdicion, actualizarSolicitudEdicion } from '../../../shared/features/solicitudes';

const MiComponente = () => {
  const [solicitudes, setSolicitudes] = useState([]);

  useEffect(() => {
    const cargarSolicitudes = async () => {
      try {
        const response = await getSolicitudesEdicion({ estado: 'pendiente' });
        setSolicitudes(response.solicitudes);
      } catch (error) {
        console.error('Error cargando solicitudes:', error);
      }
    };

    cargarSolicitudes();
  }, []);

  const aprobarSolicitud = async (id: string) => {
    try {
      await actualizarSolicitudEdicion(id, { estado: 'aceptado' });
      // Recargar solicitudes
      const response = await getSolicitudesEdicion({ estado: 'pendiente' });
      setSolicitudes(response.solicitudes);
    } catch (error) {
      console.error('Error aprobando solicitud:', error);
    }
  };

  // ... resto del componente
};
```

### 5. Crear nuevas solicitudes

```tsx
import { crearSolicitudEdicion } from '../../../shared/features/solicitudes';

const crearSolicitud = async () => {
  try {
    const nuevaSolicitud = await crearSolicitudEdicion({
      tipo: 'jugador-equipo-crear',
      entidad: equipoId,
      datosPropuestos: {
        jugadorId,
        equipoId,
        rol: 'jugador',
        fechaInicio: '2024-01-01',
        fechaFin: '2024-12-31'
      }
    });
    console.log('Solicitud creada:', nuevaSolicitud);
  } catch (error) {
    console.error('Error creando solicitud:', error);
  }
};
```

## Funcionalidades disponibles

### Servicios
- `getSolicitudesEdicion(filtros)` - Obtener solicitudes con filtros
- `getSolicitudEdicionById(id)` - Obtener solicitud específica
- `crearSolicitudEdicion(payload)` - Crear nueva solicitud
- `actualizarSolicitudEdicion(id, payload)` - Aprobar/rechazar solicitud
- `cancelarSolicitudEdicion(id)` - Cancelar solicitud
- `getSolicitudOpciones(contexto)` - Obtener tipos disponibles
- `getSolicitudesPendientes(filtro)` - Obtener pendientes
- `contarSolicitudesPendientes(filtro)` - Contar pendientes
- `getSolicitudesEstadisticas(filtro)` - Estadísticas

### Componentes
- `SolicitudEditModalSimple` - Modal para editar solicitudes simples

### Páginas
- `NotificacionesPage` - Página completa de notificaciones

## Migración desde código existente

### Antes (código duplicado en cada app)
```typescript
// En cada app tenías que importar desde rutas locales
import { getSolicitudes } from '../services/solicitudesEdicionService';
import SolicitudEditModalSimple from '../components/SolicitudEditModalSimple';
```

### Después (feature compartida)
```typescript
// Una sola importación desde shared
import { getSolicitudes, SolicitudEditModalSimple } from '../../../shared/features/solicitudes';
```

## Beneficios

1. **Reutilización**: Una sola implementación para todas las apps
2. **Mantenimiento**: Cambios en un solo lugar
3. **Consistencia**: Comportamiento idéntico en todas las apps
4. **Actualizaciones**: Nuevas funcionalidades disponibles automáticamente
5. **Tipos compartidos**: TypeScript consistente en todas las apps

## Próximos pasos

- Agregar más componentes complejos (SolicitudModal, SolicitudButton, etc.)
- Implementar contexto de React para estado global
- Agregar hooks personalizados para lógica común
- Crear componentes de estadísticas y dashboards