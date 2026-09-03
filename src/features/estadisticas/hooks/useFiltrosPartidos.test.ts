import { renderHook, act } from '@testing-library/react';
import { useFiltrosPartidos } from './useFiltrosPartidos';
import type { PartidoTimeline } from '../services/timelineService';

const partido = (
  id: string,
  opciones: {
    fecha: string;
    modalidad: string;
    rival: string;
    competencia?: { id: string; nombre: string; org: string };
  },
): PartidoTimeline => ({
  _id: id,
  fecha: opciones.fecha,
  estado: 'finalizado',
  modalidad: opciones.modalidad,
  categoria: 'Mixto',
  ubicacion: null,
  jornada: null,
  etapa: null,
  nombrePartido: null,
  esLocal: true,
  marcadorEquipo: 0,
  marcadorRival: 0,
  rival: { _id: opciones.rival, nombre: opciones.rival, escudo: null },
  competencia: opciones.competencia
    ? {
        _id: opciones.competencia.id,
        nombre: opciones.competencia.nombre,
        modalidad: opciones.modalidad,
        categoria: 'Mixto',
        organizacion: { _id: opciones.competencia.org, nombre: opciones.competencia.org },
      }
    : null,
  temporada: null,
  fase: null,
  datos: {
    oficial: { existe: false, porSets: false, directa: false, verificada: false },
    planilla: null,
    fuenteEfectiva: 'sin_datos',
  },
});

const LIGA_FOAM = { id: 'c-foam', nombre: 'Liga Foam', org: 'DB Buenos Aires' };
const LIGA_CLOTH = { id: 'c-cloth', nombre: 'Liga Cloth', org: 'DB Buenos Aires' };

const PARTIDOS: PartidoTimeline[] = [
  partido('1', { fecha: '2026-03-10T20:00:00.000Z', modalidad: 'Foam', rival: 'Marvin', competencia: LIGA_FOAM }),
  partido('2', { fecha: '2026-05-20T20:00:00.000Z', modalidad: 'Cloth', rival: 'Marvin', competencia: LIGA_CLOTH }),
  partido('3', { fecha: '2026-06-01T20:00:00.000Z', modalidad: 'Foam', rival: 'Riestra', competencia: LIGA_FOAM }),
  // Amistoso: sin competencia, sin organización. Tiene que seguir siendo alcanzable.
  partido('4', { fecha: '2025-11-02T20:00:00.000Z', modalidad: 'Foam', rival: 'Marvin' }),
];

const ids = (partidos: PartidoTimeline[]) => partidos.map((p) => p._id).sort();

describe('useFiltrosPartidos', () => {
  it('combina facetas con AND y valores con OR', () => {
    const { result } = renderHook(() => useFiltrosPartidos(PARTIDOS));

    act(() => result.current.alternar('modalidad', 'Foam'));
    act(() => result.current.alternar('rival', 'Marvin'));

    // Foam AND Marvin: el de liga y el amistoso. No el de Cloth ni el de Riestra.
    expect(ids(result.current.partidosFiltrados)).toEqual(['1', '4']);

    act(() => result.current.alternar('rival', 'Riestra'));
    // Marvin OR Riestra, siempre en Foam.
    expect(ids(result.current.partidosFiltrados)).toEqual(['1', '3', '4']);
  });

  it('elegir una modalidad deselecciona las competencias de la otra', () => {
    const { result } = renderHook(() => useFiltrosPartidos(PARTIDOS));

    act(() => result.current.alternar('competencia', LIGA_CLOTH.id));
    expect(result.current.filtros.competencia.has(LIGA_CLOTH.id)).toBe(true);

    act(() => result.current.alternar('modalidad', 'Foam'));

    // La Liga Cloth no tiene ningún partido de Foam: la selección se cae sola en vez de
    // dejar una combinación imposible que no devuelve nada.
    expect(result.current.filtros.competencia.has(LIGA_CLOTH.id)).toBe(false);
    expect(ids(result.current.partidosFiltrados)).toEqual(['1', '3', '4']);
  });

  it('el contador de una faceta ignora su propia selección', () => {
    const { result } = renderHook(() => useFiltrosPartidos(PARTIDOS));

    act(() => result.current.alternar('rival', 'Marvin'));

    // Riestra sigue ofreciéndose con su cuenta real: si mostrara 0, no se podría sumar un
    // segundo rival para compararlos.
    const riestra = result.current.opciones.rival.find((o) => o.label === 'Riestra');
    expect(riestra?.cantidad).toBe(1);

    // Y la faceta modalidad sí refleja el filtro de rival: Marvin jugó 2 de Foam y 1 de Cloth.
    const foam = result.current.opciones.modalidad.find((o) => o.label === 'Foam');
    expect(foam?.cantidad).toBe(2);
  });

  it('los amistosos son alcanzables desde las facetas de competencia y organización', () => {
    const { result } = renderHook(() => useFiltrosPartidos(PARTIDOS));

    const amistoso = result.current.opciones.organizacion.find((o) => o.label === 'Amistoso');
    expect(amistoso?.cantidad).toBe(1);

    act(() => result.current.alternar('organizacion', amistoso!.valor));
    expect(ids(result.current.partidosFiltrados)).toEqual(['4']);
  });

  it('el rango de fechas incluye el día completo del extremo hasta', () => {
    const { result } = renderHook(() => useFiltrosPartidos(PARTIDOS));

    act(() => result.current.setDesde('2026-01-01'));
    expect(ids(result.current.partidosFiltrados)).toEqual(['1', '2', '3']);

    // El partido 1 es el 10/03 a las 20:00 UTC. Con 'hasta' = ese mismo día tiene que entrar:
    // comparar contra la medianoche lo dejaba afuera.
    act(() => result.current.setHasta('2026-03-10'));
    expect(ids(result.current.partidosFiltrados)).toEqual(['1']);
  });

  it('acotar el rango deselecciona lo que quedó fuera', () => {
    const { result } = renderHook(() => useFiltrosPartidos(PARTIDOS));

    act(() => result.current.alternar('competencia', LIGA_CLOTH.id));
    act(() => result.current.setDesde('2026-06-01'));

    // La Liga Cloth sólo tiene el partido de mayo: fuera del rango, la selección se cae.
    expect(result.current.filtros.competencia.size).toBe(0);
    expect(ids(result.current.partidosFiltrados)).toEqual(['3']);
  });
});
