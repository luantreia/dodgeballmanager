# TareaToDo: Gestión de Solicitudes (DT y Manager)

Este documento resume la estandarización y el flujo completo para gestionar Solicitudes de Edición en los dos frontends: overtime-gestion-dt y overtime-gestion-manager.

## Objetivo
Unificar el uso del servicio de solicitudes, clarificar permisos/acciones y facilitar mantenimiento eliminando duplicidades.

## Arquitectura
- Servicio central por frontend
  - DT: `src/features/solicitudes/services/solicitudesEdicionService.ts`
  - Manager: `src/features/solicitudes/services/solicitudesEdicionService.ts`
  - La API devuelve arrays; el servicio calcula paginación y estadísticas en cliente.
- Adaptadores por feature (legado)
  - DT: `src/features/jugadores/services/solicitudesEdicionService.ts`
  - Manager: `src/features/jugadores/services/solicitudesEdicionService.ts`
  - Motivo: mapear `_id`→`id` y tipos simplificados usados por componentes viejos.
  - Plan: renombrar a `solicitudesEdicionApiAdapter.ts` o retirar cuando migren componentes al servicio central.
- Contexto (DT y Manager)
  - `src/app/providers/SolicitudesContext.tsx` (en cada app) orquesta listados, creación, aprobación, cancelación y contadores.

## Endpoints backend
- `GET /solicitudes-edicion?tipo&estado&creadoPor&entidad` → array simple.
- `GET /solicitudes-edicion/:id` → detalle.
- `GET /solicitudes-edicion/opciones?contexto&entidadId` → tipos disponibles por contexto.
- `POST /solicitudes-edicion` → crea solicitud.
- `PUT /solicitudes-edicion/:id` → aceptar/rechazar.
- `DELETE /solicitudes-edicion/:id` → cancelar (ver reglas).

## Tipos clave (comunes)
- `tipo`: incluye `jugador-equipo-crear` y `jugador-equipo-eliminar`, entre otros.
- `creadoPor`: userId del emisor.
- `entidad`: opcional; para jugador-equipo suele ir `null`.
- `datosPropuestos`: payload específico por tipo.

## Reglas de permisos (alineadas al backend)
- Aprobar/Rechazar
  - `jugador-equipo-crear`: aprueba la contraparte.
    - Emisor admin Equipo → aprueba admin Jugador.
    - Emisor admin Jugador → aprueba admin Equipo.
    - Admin global siempre puede.
  - `jugador-equipo-eliminar`: cualquier admin involucrado (Equipo o Jugador) o admin global.
- Cancelar
  - `jugador-equipo-crear`: cancela el creador o un admin del lado emisor; admin global también.
  - `jugador-equipo-eliminar`: solo creador o admin global.

## Ubicación de cambios relevantes
- DT
  - Servicio central actualizado: `src/features/solicitudes/services/solicitudesEdicionService.ts`.
  - UI jugadores: `src/features/jugadores/components/SolicitudesPendientesSection.tsx` filtra `crear` y `eliminar`, resuelve `contratoId→jugadorId` y aplica permisos/acciones.
- Manager
  - Servicio central actualizado: `src/features/solicitudes/services/solicitudesEdicionService.ts`.
  - UI jugador: `src/features/jugadores/components/PlayerSolicitudesEdicion.tsx` (contraparte desde la vista del jugador).

## Plan de estandarización
1) Usar el servicio central en todos los componentes nuevos.
2) Renombrar adaptadores de jugadores a `solicitudesEdicionApiAdapter.ts` para evitar confusión.
3) Migrar gradualmente componentes legados al servicio central y retirar adaptadores.

## Pruebas manuales
- Crear `jugador-equipo-crear` como admin Equipo → aprobar con admin Jugador.
- Crear `jugador-equipo-crear` como admin Jugador → aprobar con admin Equipo.
- Cancelar `crear` como creador y como admin del lado emisor; verificar backend.
- Crear `jugador-equipo-eliminar` → aprobar desde Equipo y desde Jugador; intentar cancelar como no creador (debe fallar).
- Verificar contadores en Context.

## ToDo
- [ ] Renombrar adaptadores a `solicitudesEdicionApiAdapter.ts`.
- [ ] Migrar componentes viejos al servicio central.
- [ ] Retirar adaptadores cuando no queden usos.
