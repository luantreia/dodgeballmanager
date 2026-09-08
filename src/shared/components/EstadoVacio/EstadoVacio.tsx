import type { ReactNode } from 'react';

type Props = {
  titulo: string;
  /** Qué es esto y por qué conviene tenerlo. Una frase, no un párrafo. */
  descripcion?: string;
  /** El botón que crea la primera cosa. Sin esto el componente no aporta nada. */
  accion?: ReactNode;
};

/**
 * Una sección sin datos todavía.
 *
 * Los estados vacíos eran una línea de texto gris —«No hay partidos pendientes»— que informa y no
 * ayuda. Son la mejor superficie de onboarding que tiene la app: es el único momento en que se
 * sabe con certeza qué le falta al usuario, y es exactamente cuando está mirando. Por eso lo
 * importante acá es la `accion`: el botón que crea la primera cosa, en el lugar donde el usuario
 * acaba de notar que no la tiene.
 */
const EstadoVacio = ({ titulo, descripcion, accion }: Props) => (
  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
    <p className="text-sm font-semibold text-slate-900">{titulo}</p>
    {descripcion && <p className="max-w-sm text-sm text-slate-500">{descripcion}</p>}
    {accion}
  </div>
);

export default EstadoVacio;
