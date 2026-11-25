import React, { useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import {
  solicitarOficializacion,
  type AlcanceOficializacion,
  type RespuestaOficializacion,
} from '../../services/planillaEquipoService';

/**
 * Qué se pide oficializar de una planilla. Se abre desde la planilla («Pedir oficial») y desde
 * el partido completo:
 *  - Sólo el partido: sets con su tiempo y ganador, alineaciones, marcas y cámaras. Sirve cuando
 *    se cargó el partido completo y todavía no los jugadores.
 *  - Partido y estadísticas: lo anterior más la convocatoria y los números de cada jugador.
 */
interface Props {
  planillaId: string;
  /** Sin estadísticas cargadas, sólo se puede pedir el partido. */
  tieneEstadisticas: boolean;
  onClose: () => void;
  onHecho: (resultado: RespuestaOficializacion) => void | Promise<void>;
}

const OPCIONES: Array<{ valor: AlcanceOficializacion; titulo: string; detalle: string }> = [
  {
    valor: 'estructura',
    titulo: 'Sólo el partido',
    detalle: 'Sets con su tiempo y ganador (y con eso el resultado), alineaciones, marcas y video. Sin estadísticas de jugadores.',
  },
  {
    valor: 'completa',
    titulo: 'Partido y estadísticas',
    detalle: 'Todo lo anterior, más la convocatoria y los números de cada jugador.',
  },
];

const ModalPedirOficializacion: React.FC<Props> = ({ planillaId, tieneEstadisticas, onClose, onHecho }) => {
  const [alcance, setAlcance] = useState<AlcanceOficializacion>(tieneEstadisticas ? 'completa' : 'estructura');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const r = await solicitarOficializacion(planillaId, 'organizacion', alcance);
      await onHecho(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo pedir la oficialización');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalBase isOpen size="md" onClose={onClose} title={<span className="text-base font-semibold sm:text-base">Pedir oficialización</span>}>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-slate-700">¿Qué querés que pase al partido oficial?</legend>
        {OPCIONES.map((o) => {
          const deshabilitada = o.valor === 'completa' && !tieneEstadisticas;
          return (
            <label
              key={o.valor}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                alcance === o.valor ? 'border-brand-400 bg-brand-50' : 'border-slate-200'
              } ${deshabilitada ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="alcance-oficializacion"
                value={o.valor}
                checked={alcance === o.valor}
                disabled={deshabilitada}
                onChange={() => setAlcance(o.valor)}
                className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">{o.titulo}</span>
                <span className="block text-xs text-slate-600">
                  {o.detalle}
                  {deshabilitada && ' Todavía no cargaste estadísticas en esta planilla.'}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="mt-3 text-xs text-muted">
        La organización lo revisa antes de aprobarlo. Si el partido es amistoso, pasa en el acto. Lo que el
        partido oficial ya tenga no se pisa.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:underline">
          Cancelar
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => void enviar()}
          className="min-h-[2.75rem] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Pedir oficialización'}
        </button>
      </div>
    </ModalBase>
  );
};

export default ModalPedirOficializacion;
