import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { crearApiCaptura, extraerYoutubeId, PartidoCompleto, type SetDelPartido, type VideoPartido } from 'overtime-kit/captura';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { authFetch } from '../../../../shared/utils/authFetch';
import {
  crearPlanilla,
  guardarSet,
  obtenerPlanilla,
  obtenerPlanillaDePartido,
  type PlanillaCompleta,
} from '../../services/planillaEquipoService';
import { extractEquipoId, extractEquipoNombre, type PartidoDetallado } from '../../services/partidoService';

/**
 * Primer paso de la captura de un partido: el partido completo sobre el video (sets, cuándo
 * empieza y termina cada uno y quién lo ganó), en la planilla del equipo. Los jugadores y las
 * estadísticas de cada set se cargan después, en "Capturar" (ModalPlanillaEquipo).
 *
 * El componente es de overtime-kit (`PartidoCompleto`), para poder usarlo en otras apps; acá
 * sólo se conecta con la planilla. Si el equipo todavía no tiene planilla de este partido, se
 * crea al entrar (modo set a set, con el plantel ya cargado).
 */

const api = crearApiCaptura((ruta, init) =>
  authFetch(ruta, { method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : undefined }),
);

type PlanillaConVideo = PlanillaCompleta & { videos?: VideoPartido[] };

interface Props {
  partidoId: string;
  equipoId: string;
  partido: PartidoDetallado | null;
  onClose: () => void;
  /** Al cerrar, para que la lista refleje los sets nuevos. */
  onCambio?: () => void | Promise<void>;
}

const ModalPartidoCompleto: React.FC<Props> = ({ partidoId, equipoId, partido, onClose, onCambio }) => {
  const [planilla, setPlanilla] = useState<PlanillaConVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoPartido[]>([]);

  const recargar = useCallback(async (id: string) => {
    const p = (await obtenerPlanilla(id)) as PlanillaConVideo;
    setPlanilla(p);
    return p;
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const existente = await obtenerPlanillaDePartido(equipoId, partidoId);
        const id = existente?._id
          ?? (await crearPlanilla({ partido: partidoId, equipo: equipoId, modo: 'sets', autocompletarPresentes: true }))._id;
        const p = await recargar(id);
        if (!vivo) return;
        // Las cámaras de la planilla mandan; si no tiene, las del partido (o su videoUrl).
        const delPartido = (partido as { videos?: VideoPartido[]; videoUrl?: string } | null) ?? null;
        const idUrl = extraerYoutubeId(delPartido?.videoUrl);
        setVideos(
          p.videos?.length
            ? p.videos
            : delPartido?.videos?.length
              ? delPartido.videos
              : idUrl ? [{ youtubeId: idUrl, etiqueta: 'Cámara principal', tramos: [] }] : [],
        );
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo abrir la planilla');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [equipoId, partidoId, partido, recargar]);

  const equipos = useMemo(
    () => ({
      local: { id: extractEquipoId(partido?.equipoLocal) ?? '', nombre: extractEquipoNombre(partido?.equipoLocal, 'Local') },
      visitante: { id: extractEquipoId(partido?.equipoVisitante) ?? '', nombre: extractEquipoNombre(partido?.equipoVisitante, 'Visitante') },
    }),
    [partido],
  );

  const sets: SetDelPartido[] = useMemo(
    () => (planilla?.sets ?? []).map((s) => ({ id: s._id, numeroSet: s.numeroSet, ganadorSet: s.ganadorSet, tiempo: s.tiempo ?? null })),
    [planilla],
  );

  const editable = planilla ? planilla.modo === 'sets' && ['borrador', 'rechazada'].includes(planilla.estado) : false;

  const cerrar = () => {
    void onCambio?.();
    onClose();
  };

  return (
    <ModalBase
      isOpen
      size="xl"
      onClose={cerrar}
      title={<span className="text-base font-semibold sm:text-base">Partido completo</span>}
    >
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!error && !planilla && <p className="text-sm text-muted">Abriendo la planilla…</p>}
      {planilla && planilla.modo !== 'sets' && (
        <p className="text-sm text-amber-800">
          Esta planilla es de totales del partido (sin sets): el partido completo necesita una planilla set a set.
        </p>
      )}
      {planilla && planilla.modo === 'sets' && (
        <>
          {!editable && (
            <p className="mb-3 text-sm text-muted">
              La planilla está {planilla.estado === 'oficializada' ? 'oficializada' : 'esperando oficialización'}: se puede mirar, no editar.
            </p>
          )}
          <PartidoCompleto
            api={api}
            videos={videos}
            destinoCamaras={{ planillaId: planilla._id }}
            onVideos={setVideos}
            equipos={equipos}
            sets={sets}
            refDe={(id) => ({ planillaSet: id })}
            crearSet={async (numeroSet) => (await guardarSet(planilla._id, { numeroSet }))._id}
            onCambio={async () => {
              await recargar(planilla._id);
            }}
            soloLectura={!editable}
          />
          <p className="mt-4 text-xs text-muted">
            Después, en «Capturar», cargá los jugadores de cada set: con la botonera de estadísticas o
            marcando los outs con su causa.
          </p>
        </>
      )}
    </ModalBase>
  );
};

export default ModalPartidoCompleto;
