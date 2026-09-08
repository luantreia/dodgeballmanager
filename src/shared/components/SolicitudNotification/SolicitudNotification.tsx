import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePendientesDelEquipo } from '../../features/solicitudes/hooks/usePendientesDelEquipo';

interface SolicitudNotificationProps {
  /** Reemplaza la navegación por defecto. Sin esto, la campanita lleva a Notificaciones. */
  onClick?: () => void;
  className?: string;
  showLabel?: boolean;
}

/**
 * La campanita de solicitudes pendientes.
 *
 * Tenía tres problemas que se tapaban entre sí:
 *
 * 1. **No hacía nada.** `onClick` era una prop opcional y el `Navbar` la montaba sin pasarla, así
 *    que era un botón con `onClick={undefined}`: se apretaba y no pasaba nada. Ahora navega a
 *    Notificaciones por defecto y la prop queda sólo como override.
 *
 * 2. **Desaparecía sin pendientes.** Devolvía `null` con el contador en cero. Mientras
 *    Notificaciones estuvo en el menú eso era razonable; desde que dejó de estarlo —los
 *    pendientes se muestran arriba del dashboard— la campanita es la única puerta a esa pantalla,
 *    y esconderla la volvía inalcanzable justo cuando no había nada urgente. Ahora está siempre;
 *    lo que aparece y desaparece es el badge.
 *
 * 3. **Contaba distinto que el resto de la app.** Usaba `pendientesCount` de
 *    `SolicitudesContext`, que es el total del usuario sin acotar al equipo seleccionado,
 *    mientras la barra de pestañas mostraba el conteo del equipo. Dos números para lo mismo, y en
 *    un DT con dos equipos no coincidían. Ahora los dos salen del mismo hook, que además comparte
 *    un solo temporizador — este componente tenía el suyo propio de 30 segundos.
 */
export const SolicitudNotification: React.FC<SolicitudNotificationProps> = ({
  onClick,
  className,
  showLabel = false,
}) => {
  const navigate = useNavigate();
  const pendientes = usePendientesDelEquipo();

  const etiqueta =
    pendientes === 0
      ? 'Notificaciones: no hay solicitudes pendientes'
      : `Notificaciones: ${pendientes} ${pendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`;

  return (
    <button
      type="button"
      onClick={onClick ?? (() => navigate('/notificaciones'))}
      aria-label={etiqueta}
      title={etiqueta}
      className={
        className ||
        'relative flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition [touch-action:manipulation] hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40'
      }
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {pendientes > 0 && (
        <span
          aria-hidden
          className="absolute right-1 top-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white"
        >
          {pendientes > 99 ? '99+' : pendientes}
        </span>
      )}

      {showLabel && (
        <span className="ml-2 text-sm font-medium">
          {pendientes} {pendientes === 1 ? 'solicitud' : 'solicitudes'}
        </span>
      )}
    </button>
  );
};

export default SolicitudNotification;
