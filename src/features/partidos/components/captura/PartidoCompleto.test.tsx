import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PartidoCompleto, type ApiCaptura, type SetDelPartido } from 'overtime-kit/captura';

const equipos = { local: { id: 'A', nombre: 'MORAN' }, visitante: { id: 'B', nombre: 'MARVIN' } };

function Arnes({ llamadas }: { llamadas: string[] }) {
  const [sets, setSets] = useState<SetDelPartido[]>([]);
  const api = {
    guardarTiempo: async (ref: { planillaSet: string }, t: { desde: number; hasta: number }) => {
      llamadas.push(`tiempo ${ref.planillaSet} ${t.desde}-${t.hasta}`);
      setSets((xs) => xs.map((s) => (s.id === ref.planillaSet ? { ...s, tiempo: t } : s)));
    },
    guardarGanador: async (ref: { planillaSet: string }, g: SetDelPartido['ganadorSet']) => {
      llamadas.push(`ganador ${ref.planillaSet} ${g}`);
      setSets((xs) => xs.map((s) => (s.id === ref.planillaSet ? { ...s, ganadorSet: g } : s)));
    },
  } as unknown as ApiCaptura;
  return (
    <PartidoCompleto
      api={api}
      videos={[]}
      destinoCamaras={{ planillaId: 'p1' }}
      equipos={equipos}
      sets={sets}
      refDe={(id) => ({ planillaSet: id })}
      crearSet={async (n) => {
        llamadas.push(`crear ${n}`);
        setSets((xs) => [...xs, { id: `s${n}`, numeroSet: n, ganadorSet: 'pendiente', tiempo: null }]);
        return `s${n}`;
      }}
      onCambio={() => undefined}
    />
  );
}

describe('PartidoCompleto', () => {
  it('arma los sets del partido con su tiempo y su ganador, y suma el resultado', async () => {
    const llamadas: string[] = [];
    render(<Arnes llamadas={llamadas} />);
    expect(screen.getByText(/no tiene video/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Set 1 sin tiempo' }));
    expect(await screen.findByText('Set 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'editar' }));
    fireEvent.change(screen.getByLabelText('Inicio del set 1'), { target: { value: '2:00' } });
    fireEvent.change(screen.getByLabelText('Fin del set 1'), { target: { value: '1:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('fin después del inicio');
    fireEvent.change(screen.getByLabelText('Fin del set 1'), { target: { value: '5:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('(3:30)')).toBeInTheDocument();

    const moran = within(screen.getByRole('group', { name: 'Ganador del set 1' })).getByRole('button', { name: 'MORAN' });
    await waitFor(() => expect(moran).not.toBeDisabled()); // terminó de guardar el tiempo
    fireEvent.click(moran);
    expect(await screen.findByText('MORAN 1 – 0 MARVIN')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('button', { name: '+ Set 2 sin tiempo' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: '+ Set 2 sin tiempo' }));
    expect(await screen.findByText('Set 2')).toBeInTheDocument();
    expect(llamadas).toEqual(['crear 1', 'tiempo s1 120-330', 'ganador s1 local', 'crear 2']);
  });

  it('un set de la consola se confirma donde está, y muestra el inicio y fin del partido', async () => {
    const llamadas: string[] = [];
    const api = {
      guardarTiempo: async (ref: { planillaSet: string }, t: { desde: number; hasta: number; origen: string; confirmado: boolean }, op?: { marcarAhora?: boolean }) => {
        llamadas.push(`tiempo ${ref.planillaSet} ${t.desde}-${t.hasta} ${t.origen} ${t.confirmado} ${op?.marcarAhora}`);
      },
    } as unknown as ApiCaptura;
    render(
      <PartidoCompleto
        api={api}
        videos={[]}
        destinoCamaras={{ planillaId: 'p1' }}
        equipos={equipos}
        ventana={{ desde: 81, hasta: 1741, origen: 'en_vivo', confirmado: false }}
        sets={[{ id: 's1', numeroSet: 1, ganadorSet: 'visitante', tiempo: { desde: 81, hasta: 285, origen: 'en_vivo', confirmado: false } }]}
        refDe={(id) => ({ planillaSet: id })}
        crearSet={async () => 'x'}
        onCambio={() => undefined}
      />,
    );
    expect(screen.getByText('en vivo (consola) · sin confirmar')).toBeInTheDocument();
    expect(screen.getByText('(27:40)')).toBeInTheDocument();
    expect(screen.getByText('consola')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '✓ confirmar' }));
    await waitFor(() => expect(llamadas).toEqual(['tiempo s1 81-285 en_vivo true false']));
  });
});
