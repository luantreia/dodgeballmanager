import React, { useMemo, useRef, useState } from 'react';
import {
  CamarasPartido,
  CapturaSet,
  crearApiCaptura,
  extraerYoutubeId,
  ReproductorPartido,
  type EquipoCaptura,
  type JugadorCaptura,
  type ReproductorPartidoHandle,
  type VideoPartido,
} from 'overtime-kit/captura';
import { authFetch } from '../../../../shared/utils/authFetch';
import type { PlanillaPresente } from '../../services/planillaEquipoService';

/**
 * Captura de un set de la planilla con el video del partido: marcar cuándo empieza y termina,
 * quiénes arrancan, y cada out/reingreso, con la línea de vivos. Los componentes son de
 * `overtime-kit/captura` (los mismos en las cuatro apps que capturan); acá sólo se conectan
 * con la planilla.
 *
 * Las marcas mandan: si el set tiene marcas, outs/hits/catches/sobrevive de la planilla se
 * recalculan desde ellas en el backend (`throws` sigue siendo a mano).
 */

const api = crearApiCaptura((ruta, init) =>
  authFetch(ruta, { method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : undefined }),
);

interface Props {
  partidoId: string;
  planillaSetId: string;
  equipos: EquipoCaptura[];
  presentes: PlanillaPresente[];
  /** `videos` y `videoUrl` del partido, como vienen del backend. */
  videos?: VideoPartido[];
  videoUrl?: string | null;
  editable: boolean;
  /** Después de cada cambio: recargar la planilla para ver las estadísticas recalculadas. */
  onCambio?: () => void;
}

const nombreDe = (p: PlanillaPresente): string => {
  const j = p.jugador;
  if (!j || typeof j === 'string') return 'Jugador';
  return j.alias || [j.nombre, j.apellido].filter(Boolean).join(' ') || 'Jugador';
};

const CapturaVideoSet: React.FC<Props> = ({
  partidoId, planillaSetId, equipos, presentes, videos: videosIniciales, videoUrl, editable, onCambio,
}) => {
  const reproductor = useRef<ReproductorPartidoHandle>(null);
  // Un partido viejo sólo tiene `videoUrl`: se trata como una cámara.
  const [videos, setVideos] = useState<VideoPartido[]>(() => {
    if (videosIniciales?.length) return videosIniciales;
    const id = extraerYoutubeId(videoUrl);
    return id ? [{ youtubeId: id, etiqueta: 'Cámara principal', tramos: [] }] : [];
  });
  const [verCamaras, setVerCamaras] = useState(false);

  const jugadores: JugadorCaptura[] = useMemo(
    () =>
      presentes
        .filter((p) => p.rol !== 'entrenador')
        .map((p) => ({
          id: typeof p.jugador === 'string' ? p.jugador : p.jugador?._id ?? '',
          nombre: nombreDe(p),
          numero: p.numero ?? null,
          equipo: (typeof p.equipo === 'string' ? p.equipo : p.equipo?._id) ?? equipos[0]?.id ?? '',
        }))
        .filter((j) => j.id),
    [presentes, equipos],
  );

  return (
    <div className="space-y-3">
      {videos.length > 0 ? (
        <ReproductorPartido ref={reproductor} videos={videos} />
      ) : (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted">
          El partido no tiene video: los tiempos se toman con el cronómetro del set.
        </p>
      )}

      <div>
        <button type="button" onClick={() => setVerCamaras((v) => !v)} className="text-sm text-brand-700 hover:underline">
          {verCamaras ? 'Ocultar cámaras' : `Cámaras del partido (${videos.length})`}
        </button>
        {verCamaras && (
          <div className="mt-2">
            <CamarasPartido api={api} partidoId={partidoId} videos={videos} onGuardado={setVideos} soloLectura={!editable} />
          </div>
        )}
      </div>

      <CapturaSet
        api={api}
        refSet={{ planillaSet: planillaSetId }}
        equipos={equipos}
        jugadores={jugadores}
        obtenerTiempo={videos.length ? () => reproductor.current?.segundoPartido() ?? null : undefined}
        irA={(s) => reproductor.current?.irA(s)}
        soloLectura={!editable}
        onCambio={(e) => {
          if (e.sync?.sincronizado) onCambio?.();
        }}
      />
    </div>
  );
};

export default CapturaVideoSet;
