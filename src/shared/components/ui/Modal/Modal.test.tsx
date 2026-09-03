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
});
