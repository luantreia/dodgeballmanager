import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

/**
 * Los modales se apilan de verdad: la confirmación de "eliminar planilla" se abre encima del
 * modal de la planilla. Estos dos casos cubren lo que se rompía con esa pila.
 */
describe('Modal apilado', () => {
  it('Escape cierra sólo el modal de arriba', () => {
    const cerrarFondo = jest.fn();
    const cerrarArriba = jest.fn();

    render(
      <>
        <Modal isOpen onClose={cerrarFondo}>
          <p>fondo</p>
        </Modal>
        <Modal isOpen onClose={cerrarArriba}>
          <p>arriba</p>
        </Modal>
      </>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(cerrarArriba).toHaveBeenCalledTimes(1);
    expect(cerrarFondo).not.toHaveBeenCalled();
  });

  it('el scroll del body se libera recién al cerrar el último modal', () => {
    // Los onClose van fuera del render y son estables a propósito. Con un `jest.fn()` inline,
    // cada rerender crea una función nueva, el efecto del modal de abajo se vuelve a ejecutar
    // (onClose es una de sus dependencias) y repone `overflow: hidden` por su cuenta: el test
    // pasaba incluso con el conteo de modales roto.
    const cerrarFondo = jest.fn();
    const cerrarArriba = jest.fn();
    const escena = (fondoAbierto: boolean, arribaAbierto: boolean) => (
      <>
        <Modal isOpen={fondoAbierto} onClose={cerrarFondo}>
          <p>fondo</p>
        </Modal>
        <Modal isOpen={arribaAbierto} onClose={cerrarArriba}>
          <p>arriba</p>
        </Modal>
      </>
    );

    const { rerender } = render(escena(true, true));
    expect(document.body.style.overflow).toBe('hidden');

    // Se cierra el de arriba; el de abajo sigue abierto y tiene que seguir bloqueando.
    rerender(escena(true, false));
    expect(screen.getByText('fondo')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    rerender(escena(false, false));
    expect(document.body.style.overflow).toBe('unset');
  });

  it('Escape cierra sólo el de arriba también cuando nace anidado como hijo de JSX', () => {
    // Caso real, no artificial: una confirmación de borrado escrita como hijo del modal que la
    // abre, con los dos ya montados en el mismo commit —
    //   <Modal isOpen onClose={cerrarFondo}><Modal isOpen onClose={cerrarArriba} /></Modal>
    // Antes esto rompía la pila: React corre los efectos de los hijos ANTES que los del padre
    // dentro de un mismo commit, así que si el nivel/z-index se asignaba en un efecto, el HIJO
    // (que va arriba en pantalla) se registraba primero y quedaba con el número más bajo; el
    // padre se registraba después y terminaba "ganando" el de arriba según ese número, al revés
    // de cómo se ve. Resultado real: Escape cerraba el modal de fondo en vez de la confirmación,
    // y como la confirmación vivía adentro del fondo, se perdían los dos de un tirón.
    const cerrarFondo = jest.fn();
    const cerrarArriba = jest.fn();

    render(
      <Modal isOpen onClose={cerrarFondo}>
        <p>fondo</p>
        <Modal isOpen onClose={cerrarArriba}>
          <p>arriba</p>
        </Modal>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(cerrarArriba).toHaveBeenCalledTimes(1);
    expect(cerrarFondo).not.toHaveBeenCalled();
  });
});
