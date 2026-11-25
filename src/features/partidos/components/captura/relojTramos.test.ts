import { camaraAPartido, cortarDesde, partidoACamara, type VideoPartido } from 'overtime-kit/captura';

describe('cortarDesde: el video perdió un pedazo', () => {
  // Transmisión cortada 2 minutos antes del set 3: en el video, el set 3 arranca en 6:50 (410 s) y en el
  // tiempo del partido (la consola) es 8:50 (530 s).
  const video: VideoPartido = { youtubeId: 'AAAAAAAAAAA', duracion: 2000, tramos: [] };
  const tramos = cortarDesde(video, 405, 530 - 410);
  const cortado = { ...video, tramos };

  it('antes del corte el video sigue igual', () => {
    expect(camaraAPartido(cortado, 306)).toBe(306); // set 2: 5:06
  });
  it('después del corte el video se corre lo que duró el corte', () => {
    expect(camaraAPartido(cortado, 410)).toBe(530);
    expect(partidoACamara(cortado, 530)).toBe(410);
  });
  it('un segundo corte suma otro tramo sin tocar los anteriores', () => {
    const dos = cortarDesde(cortado, 1000, 180);
    expect(dos.map((t) => t.d)).toEqual([0, 120, 180]);
    expect(camaraAPartido({ ...video, tramos: dos }, 900)).toBe(1020);
  });
});
