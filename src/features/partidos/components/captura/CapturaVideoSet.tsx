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
  planillaId: string;
  planillaSetId: string;
  equipos: EquipoCaptura[];
  presentes: PlanillaPresente[];
  /** Cámaras propias de la planilla. Vacío = se usan las del partido. */
  videosPlanilla?: VideoPartido[];
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
  planillaId, planillaSetId, equipos, presentes, videosPlanilla, videos: videosPartido, videoUrl, editable, onCambio,
}) => {
  const reproductor = useRef<ReproductorPartidoHandle>(null);
  // Las cámaras de la planilla mandan; si no tiene, se arranca con las del partido (un partido
  // viejo sólo tiene `videoUrl`: se trata como una cámara). Guardar siempre escribe en la
  // planilla, nunca en el partido: lo oficial se actualiza al oficializar.
  const [propias, setPropias] = useState(Boolean(videosPlanilla?.length));
  const [videos, setVideos] = useState<VideoPartido[]>(() => {
    if (videosPlanilla?.length) return videosPlanilla;
    if (videosPartido?.length) return videosPartido;
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
          {verCamaras ? 'Ocultar cámaras' : `Cámaras ${propias ? 'de la planilla' : 'del partido'} (${videos.length})`}
        </button>
        {verCamaras && (
          <div className="mt-2 space-y-2">
            {!propias && editable && (
              <p className="text-xs text-muted">
                Son las del partido. Si agregás o alineás una, se guardan en esta planilla y pasan al partido cuando se oficialice.
              </p>
            )}
            <CamarasPartido
              api={api}
              planillaId={planillaId}
              videos={videos}
              onGuardado={(v) => {
                setVideos(v);
                setPropias(v.length > 0);
              }}
              soloLectura={!editable}
            />
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
