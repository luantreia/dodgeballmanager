import { useEffect, useMemo, useState } from 'react';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { useToken } from '../../../app/providers/AuthContext';
import { ModalPartidoAdmin } from '../../partidos/components';
import { getResumenOficialEquipo, type ResumenOficialEquipo } from '../services/estadisticasService';
import EstadisticaCard from '../../../shared/components/EstadisticaCard';
import { ChartBarIcon, ShieldCheckIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { SeccionTop5estadisticasDirectas } from '../components/sections/SeccionTop5estadisticasDirectas';
import SeccionMisPlanillas from '../components/sections/SeccionMisPlanillas';
import AnalisisCruzado from '../components/sections/AnalisisCruzado';
import SeccionLineaTemporal from '../components/sections/SeccionLineaTemporal';

/**
 * Estadísticas del equipo.
 *
 * La cabecera muestra los totales OFICIALES de la competencia; debajo van las planillas
 * propias del equipo, que son datos sin verificar y nunca se suman a los de arriba.
 *
 * Lo que había antes acá pedía `/estadisticas?equipo=` y `/estadisticas/historial?equipo=`,
 * dos rutas que no existen en el backend, y renderizaba puntos/bloqueos/faltas/racha:
 * campos que tampoco existen y que además son de otro deporte. La pantalla entraba
 * siempre por el `catch` y mostraba vacío. Ahora consume el endpoint real,
 * `/estadisticas/equipo/:id/resumen`, que devuelve throws/hits/outs/catches.
 */
const EstadisticasPage = () => {
  const { equipoSeleccionado } = useEquipo();
  const { addToast } = useToast();
  const token = useToken();
  const [oficial, setOficial] = useState<ResumenOficialEquipo | null>(null);
  const [loading, setLoading] = useState(false);
  const [partidoAbierto, setPartidoAbierto] = useState<string | null>(null);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setOficial(null);
      return;
    }

    let cancelado = false;

    const cargar = async (): Promise<void> => {
      try {
        setLoading(true);
        const data = await getResumenOficialEquipo(equipoId);
        if (!cancelado) setOficial(data);
      } catch (err) {
        console.error(err);
        if (!cancelado) {
          addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar las estadísticas oficiales.' });
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    void cargar();
    return () => { cancelado = true; };
  }, [equipoSeleccionado?.id, addToast]);

  const cards = useMemo(() => {
    if (!oficial) return [];
    const { throws, hits, outs, catches } = oficial.totales;
    const efectividad = throws > 0 ? (hits / throws) * 100 : null;

    return [
      {
        titulo: 'Partidos con datos',
        valor: String(oficial.partidosJugados),
        descripcion: 'Partidos con estadísticas oficiales cargadas.',
        icono: <TrophyIcon className="h-6 w-6" />,
        tono: 'brand' as const,
      },
      {
        titulo: 'Efectividad',
        valor: efectividad !== null ? `${efectividad.toFixed(0)}%` : '—',
        descripcion: `${hits} hits sobre ${throws} throws.`,
        icono: <ShieldCheckIcon className="h-6 w-6" />,
        tono: 'emerald' as const,
      },
      {
        titulo: 'Catches',
        valor: String(catches),
        descripcion: `${outs} outs recibidos en total.`,
        icono: <ChartBarIcon className="h-6 w-6" />,
        tono: 'amber' as const,
      },
    ];
  }, [oficial]);

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Seleccioná un equipo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Elegí un equipo para ver su rendimiento histórico.
        </p>
      </div>
    );
  }

  const sinDatosOficiales = !loading && oficial !== null && oficial.partidosJugados === 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Estadísticas del equipo</h1>
        <p className="text-sm text-slate-500">
          Arriba, lo oficial de la competencia. Abajo, lo que capturó tu equipo por su cuenta.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">Oficial</h2>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            Verificado
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando estadísticas…</p>
        ) : cards.length > 0 && !sinDatosOficiales ? (
          <div className="grid gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <EstadisticaCard key={card.titulo} {...card} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
            La competencia todavía no tiene estadísticas oficiales cargadas para este equipo.
            Tus planillas de acá abajo no dependen de esto.
          </div>
        )}
      </section>

      <SeccionLineaTemporal
        equipoId={equipoSeleccionado.id}
        equipoNombre={equipoSeleccionado.nombre}
        token={token ?? ''}
      />

      {/* Debajo de las métricas oficiales y visualmente separadas: son datos propios del
          equipo, sin verificar, y no se suman a ninguna cifra de arriba. */}
      <SeccionMisPlanillas equipoId={equipoSeleccionado.id} />

      <AnalisisCruzado
        equipoId={equipoSeleccionado.id}
        onAbrirPartido={setPartidoAbierto}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <SeccionTop5estadisticasDirectas equipoId={equipoSeleccionado.id} />
      </section>

      {partidoAbierto && (
        <ModalPartidoAdmin
          partidoId={partidoAbierto}
          token={token ?? ''}
          equipoId={equipoSeleccionado.id}
          onClose={() => setPartidoAbierto(null)}
          onPartidoEliminado={() => setPartidoAbierto(null)}
        />
      )}
    </div>
  );
};

export default EstadisticasPage;
