import { useEffect, useState } from 'react';
import CompetenciaCard from '../../../shared/components/CompetenciaCard';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { getParticipaciones, solicitarInscripcion } from '../services/equipoCompetenciaService';
import type { EquipoCompetencia } from '../../../types';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { Input, Textarea } from '../../../shared/components/ui';

const CompetenciasPage = () => {
  const { addToast } = useToast();
  const { equipoSeleccionado } = useEquipo();
  const [participaciones, setParticipaciones] = useState<EquipoCompetencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [inscripcionLoading, setInscripcionLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [competenciaId, setCompetenciaId] = useState('');
  

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
  }, [equipoSeleccionado?.id]);

  const refresh = async () => {
    if (!equipoSeleccionado) return;
    const data = await getParticipaciones({ equipoId: equipoSeleccionado.id });
    setParticipaciones(data);
  };

  const handleInscripcion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!equipoSeleccionado || !competenciaId) return;

    try {
      setInscripcionLoading(true);
      await solicitarInscripcion({
        equipoId: equipoSeleccionado.id,
        competenciaId,
        mensaje: mensaje || undefined,
      });
      addToast({ type: 'success', title: 'Solicitud enviada', message: 'La inscripción fue enviada correctamente' });
      setCompetenciaId('');
      setMensaje('');
      await refresh();
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error de inscripción', message: 'No pudimos enviar la solicitud' });
    } finally {
      setInscripcionLoading(false);
    }
  };

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Seleccioná un equipo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Necesitamos saber qué equipo gestionás para mostrar sus competencias.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Competencias</h1>
        <p className="text-sm text-slate-500">
          Visualizá las participaciones actuales y enviá solicitudes de inscripción.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Solicitar inscripción</h2>
        <p className="mt-1 text-sm text-slate-500">Completá los datos de la competencia que deseás solicitar.</p>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleInscripcion}>
          <div className="md:col-span-1">
            <Input
              id="competenciaId"
              label="ID de competencia"
              value={competenciaId}
              onChange={(event) => setCompetenciaId((event.target as HTMLInputElement).value)}
              required
              placeholder="competencia_123"
            />
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

      {loading ? (
        <p className="text-sm text-slate-500">Cargando participaciones…</p>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {participaciones.map((participacion) => (
            <CompetenciaCard key={participacion.id} participacion={participacion} />
          ))}
          {participaciones.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              Aún no tenés participaciones registradas.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
};

export default CompetenciasPage;
