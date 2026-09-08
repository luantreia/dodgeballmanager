import { useEffect, useState } from 'react';
import CompetenciaCard from '../../../shared/components/CompetenciaCard';
import DetalleCompetencia from './DetalleCompetencia';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { getParticipaciones } from '../services/equipoCompetenciaService';
import type { EquipoCompetencia } from '../../../shared/utils/types/types';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { Textarea } from '../../../shared/components/ui';
import { opcionesTemporadasParaEquipo, crearSolicitudParticipacionTemporada, type TemporadaOpcion } from '../services/participacionTemporadaService';

const SeccionCompetencias = () => {
  const { addToast } = useToast();
  const { equipoSeleccionado } = useEquipo();
  const [participaciones, setParticipaciones] = useState<EquipoCompetencia[]>([]);
  const [abierta, setAbierta] = useState<{ id: string; nombre: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [inscripcionLoading, setInscripcionLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tempSearch, setTempSearch] = useState('');
  const [tempOptions, setTempOptions] = useState<TemporadaOpcion[]>([]);
  const [temporadaSeleccionada, setTemporadaSeleccionada] = useState<TemporadaOpcion | null>(null);
  

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setParticipaciones([]);
      return;
    }

    let isCancelled = false;

    const fetchParticipaciones = async () => {
      try {
        setLoading(true);
        const data = await getParticipaciones({ equipoId });
        if (isCancelled) return;
        setParticipaciones(data);
      } catch (error) {
        console.error(error);
        if (!isCancelled) {
          addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar las competencias del equipo.' });
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchParticipaciones();

    return () => {
      isCancelled = true;
    };
  }, [equipoSeleccionado?.id, addToast]);

  const refresh = async () => {
    if (!equipoSeleccionado) return;
    const data = await getParticipaciones({ equipoId: equipoSeleccionado.id });
    setParticipaciones(data);
  };

  const handleInscripcion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!equipoSeleccionado || !temporadaSeleccionada?._id) return;

    try {
      setInscripcionLoading(true);
      await crearSolicitudParticipacionTemporada(temporadaSeleccionada._id, equipoSeleccionado.id);
      addToast({ type: 'success', title: 'Solicitud enviada', message: 'La inscripción fue enviada correctamente' });
      setTemporadaSeleccionada(null);
      setTempSearch('');
      setMensaje('');
      await refresh();
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error de inscripción', message: 'No pudimos enviar la solicitud' });
    } finally {
      setInscripcionLoading(false);
    }
  };

  const buscarTemporadas = async (q: string) => {
    setTempSearch(q);
    setTemporadaSeleccionada(null);
    if (!equipoSeleccionado) return;
    if (!q || q.trim().length < 2) { setTempOptions([]); return; }
    const opts = await opcionesTemporadasParaEquipo(equipoSeleccionado.id, q.trim());
    setTempOptions(opts);
  };

  if (!equipoSeleccionado) return null;

  // Abrir una competencia reemplaza el índice en vez de apilarse debajo: adentro hay tres
  // pestañas propias, y anidarlas dentro de una lista scrolleable haría perder el hilo de dónde
  // está uno parado.
  if (abierta) {
    return (
      <DetalleCompetencia
        competenciaId={abierta.id}
        competenciaNombre={abierta.nombre}
        equipoId={equipoSeleccionado.id}
        onVolver={() => setAbierta(null)}
      />
    );
  }

  return (
    <div className="space-y-6">

      {equipoSeleccionado.verificado === false ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Equipo pendiente de verificación</h2>
          <p className="mt-2 text-sm text-amber-800">
            {equipoSeleccionado.nombre} todavía no fue verificado por Overtime, así que no puede
            inscribirse a competencias. Mientras tanto podés cargar la plantilla, organizar amistosos y
            registrar estadísticas con normalidad.
          </p>
          <p className="mt-3 text-sm text-amber-800">
            La verificación la hace un administrador de Overtime. Si ya pasó un tiempo, escribinos.
          </p>
        </section>
      ) : (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Solicitar inscripción</h2>
        <p className="mt-1 text-sm text-slate-500">Completá los datos de la competencia que deseás solicitar.</p>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleInscripcion}>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Buscar temporada</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Nombre de la temporada"
              value={tempSearch}
              onChange={(e) => { void buscarTemporadas((e.target as HTMLInputElement).value); }}
            />
            {tempOptions.length > 0 ? (
              <div className="mt-1 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white">
                {tempOptions.map((opt) => (
                  <button
                    key={opt._id}
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                    onClick={() => { setTemporadaSeleccionada(opt); setTempSearch(opt.nombre || ''); setTempOptions([]); }}
                  >
                    {opt.nombre}
                  </button>
                ))}
              </div>
            ) : null}
            {temporadaSeleccionada ? (
              <p className="mt-1 text-xs text-slate-600">Seleccionada: {temporadaSeleccionada.nombre}</p>
            ) : null}
          </div>

          <div className="md:col-span-1">
            <Textarea
              id="mensaje"
              label="Mensaje opcional"
              value={mensaje}
              rows={3}
              onChange={(event) => setMensaje((event.target as HTMLTextAreaElement).value)}
              placeholder="Contanos por qué querés sumarte"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={inscripcionLoading}
              className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-400"
            >
              {inscripcionLoading ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </section>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando participaciones…</p>
      ) : (
        <section className="space-y-4">
          {participaciones.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              Aún no tenés participaciones registradas.
            </p>
          ) : null}

          {/* La tabla dejó de venir desplegada debajo de cada tarjeta: con dos o tres
              competencias eran tres tablas apiladas y ninguna pregunta contestada. Ahora cada
              competencia se abre, y adentro está todo lo suyo —tabla, plantel habilitado y
              balance— en vez de repartido por la app. */}
          {participaciones.map((participacion) => (
            <div key={participacion.id} className="space-y-2">
              <CompetenciaCard participacion={participacion} />
              {participacion.competencia?.id ? (
                <button
                  type="button"
                  onClick={() =>
                    setAbierta({
                      id: participacion.competencia!.id!,
                      nombre: participacion.competencia?.nombre ?? 'Competencia',
                    })
                  }
                  className="min-h-[2.75rem] w-full rounded-lg border border-brand-300 bg-brand-50 px-4 text-sm font-semibold text-brand-700 transition [touch-action:manipulation] hover:bg-brand-100"
                >
                  Abrir competencia →
                </button>
              ) : null}
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default SeccionCompetencias;
