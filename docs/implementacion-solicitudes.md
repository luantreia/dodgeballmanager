# Implementación de Solicitudes (DT)

Este documento describe cómo implementar, usar y extender la Gestión de Solicitudes en el frontend DT.

## Resumen
- Servicio central: `src/features/solicitudes/services/solicitudesEdicionService.ts`.
- Tipos: `src/types/solicitudesEdicion.ts`.
- UI de equipo > jugadores: `src/features/jugadores/components/SolicitudesPendientesSection.tsx`.
- Contexto global opcional: `src/app/providers/SolicitudesContext.tsx`.

## Endpoints Backend (referencia)
- GET `/solicitudes-edicion?tipo&estado&creadoPor&entidad` → array de solicitudes.
- GET `/solicitudes-edicion/:id` → detalle.
- GET `/solicitudes-edicion/opciones?contexto&entidadId` → tipos disponibles.
- POST `/solicitudes-edicion` → crea solicitud.
- PUT `/solicitudes-edicion/:id` → aprobar/rechazar.
- DELETE `/solicitudes-edicion/:id` → cancelar (si corresponde).

## Tipos soportados clave (Jugador-Equipo)
- `jugador-equipo-crear` (ingresar al equipo).
- `jugador-equipo-eliminar` (abandonar equipo con contratoId).
- `jugador-equipo-editar` (editar vínculo; usa `entidad` = contratoId y payload con campos).

## Permisos (alineados al backend)
- Aprobar/Rechazar:
  - Crear: aprueba la contraparte (si lo crea admin Equipo → aprueba admin Jugador; y viceversa). Admin global siempre puede.
  - Eliminar/Editar: puede aprobar cualquier admin involucrado (equipo o jugador) y admin global.
- Cancelar:
  - Crear: creador o admin del lado emisor; admin global también.
  - Eliminar/Editar: solo creador o admin global.

## Uso del servicio central
```ts
import {
  getSolicitudesEdicion,
  crearSolicitudEdicion,
  actualizarSolicitudEdicion,
  cancelarSolicitudEdicion,
} from 'src/features/solicitudes/services/solicitudesEdicionService';

// Listar pendientes
const { solicitudes } = await getSolicitudesEdicion({ estado: 'pendiente' });

// Crear (ingresar)
await crearSolicitudEdicion({
  tipo: 'jugador-equipo-crear',
  datosPropuestos: { jugadorId, equipoId, rol, fechaInicio, fechaFin },
});

// Eliminar (abandonar) con contratoId
await crearSolicitudEdicion({
  tipo: 'jugador-equipo-eliminar',
  datosPropuestos: { contratoId },
});

// Editar (entidad = contratoId)
await crearSolicitudEdicion({
  tipo: 'jugador-equipo-editar',
  entidad: contratoId,
  datosPropuestos: { rol, fechaInicio, fechaFin, estado, foto },
});

// Aprobar
await actualizarSolicitudEdicion(solicitudId, { estado: 'aceptado' });

// Rechazar
await actualizarSolicitudEdicion(solicitudId, { estado: 'rechazado', motivoRechazo: '…' });

// Cancelar
await cancelarSolicitudEdicion(solicitudId);
```

## UI: SolicitudesPendientesSection.tsx
- Filtra solicitudes del equipo actual (crear/eliminar/editar).
- Resuelve `contratoId → jugadorId` para permisos/etiquetas.
- Muestra detalles de cada solicitud y botones según reglas de permisos.

## Extender
- Agregar nuevos tipos en `src/types/solicitudesEdicion.ts`.
- Consumir desde el servicio central; evitar crear adaptadores nuevos.
- Para UI, extender condiciones de filtrado y bloques de detalle.

## Pruebas manuales sugeridas
1) Crear `jugador-equipo-crear` como admin Equipo → aprobar con admin Jugador.
2) Crear `jugador-equipo-crear` como admin Jugador → aprobar con admin Equipo.
3) Cancelaciones: crear vs eliminar/editar (ver restricciones).
4) Crear `jugador-equipo-eliminar` y `jugador-equipo-editar` → aprobar desde Equipo/Jugador.
5) Verificar contadores y estados en la lista.
