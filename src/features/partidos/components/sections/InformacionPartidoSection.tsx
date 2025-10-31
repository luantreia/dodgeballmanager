import React from 'react';
import { PartidoDetallado } from '../../services/partidoService';
import { Competencia } from '../../../../types';

type DatosEdicionState = {
  fecha: string;
  ubicacion: string;
  estado: string;
  nombrePartido: string;
  marcadorLocal: number;
  marcadorVisitante: number;
  modalidad: string;
  categoria: string;
  competencia: string;
};

type InformacionPartidoSectionProps = {
  partido: PartidoDetallado;
  modoEdicion: boolean;
  datosEdicion: DatosEdicionState;
  competencias: Competencia[];
  onToggleModoEdicion: (activo: boolean) => void;
  onChangeDatosEdicion: <K extends keyof DatosEdicionState>(field: K, value: DatosEdicionState[K]) => void;
  onGuardar: () => void;
  onRecalcular: () => void;
};

export const InformacionPartidoSection: React.FC<InformacionPartidoSectionProps> = ({
  partido,
  modoEdicion,
  datosEdicion,
  competencias,
  onToggleModoEdicion,
  onChangeDatosEdicion,
  onGuardar,
  onRecalcular,
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Información del Partido</h2>
        {!modoEdicion ? (
          <button
            onClick={() => onToggleModoEdicion(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Editar
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={onGuardar}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Guardar
            </button>
            <button
              onClick={() => onToggleModoEdicion(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {modoEdicion ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del Partido</label>
            <input
              type="text"
              value={datosEdicion.nombrePartido}
              onChange={(e) => onChangeDatosEdicion('nombrePartido', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha y Hora</label>
              <input
                type="datetime-local"
                value={datosEdicion.fecha}
                onChange={(e) => onChangeDatosEdicion('fecha', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ubicación</label>
              <input
                type="text"
                value={datosEdicion.ubicacion}
                onChange={(e) => onChangeDatosEdicion('ubicacion', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Estado</label>
              <select
                value={datosEdicion.estado}
                onChange={(e) => onChangeDatosEdicion('estado', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="programado">Programado</option>
                <option value="en_juego">En Juego</option>
                <option value="finalizado">Finalizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Modalidad</label>
              <select
                value={datosEdicion.modalidad}
                onChange={(e) => onChangeDatosEdicion('modalidad', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                <option value="Foam">Foam</option>
                <option value="Cloth">Cloth</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Categoría</label>
              <select
                value={datosEdicion.categoria}
                onChange={(e) => onChangeDatosEdicion('categoria', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Mixto">Mixto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Competencia</label>
            <select
              value={datosEdicion.competencia}
              onChange={(e) => onChangeDatosEdicion('competencia', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Sin competencia</option>
              {competencias.map((competencia) => (
                <option key={competencia.id} value={competencia.id}>
                  {competencia.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Marcador Local</label>
              <input
                type="number"
                value={datosEdicion.marcadorLocal}
                onChange={(e) => onChangeDatosEdicion('marcadorLocal', Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Marcador Visitante</label>
              <input
                type="number"
                value={datosEdicion.marcadorVisitante}
                onChange={(e) => onChangeDatosEdicion('marcadorVisitante', Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                min="0"
              />
            </div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onRecalcular}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Recalcular marcador
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p><strong>Nombre:</strong> {partido.nombrePartido || 'No especificado'}</p>
          <p><strong>Fecha:</strong> {partido.fecha ? new Date(partido.fecha).toLocaleString() : 'No especificada'}</p>
          <p><strong>Ubicación:</strong> {partido.ubicacion || 'No especificada'}</p>
          <p><strong>Estado:</strong> {partido.estado || 'No especificado'}</p>
          <p><strong>Modalidad:</strong> {partido.modalidad || 'No especificada'}</p>
          <p><strong>Categoría:</strong> {partido.categoria || 'No especificada'}</p>
          <p>
            <strong>Competencia:</strong>{' '}
            {typeof partido.competencia === 'string'
              ? partido.competencia
              : partido.competencia?.nombre || 'No especificada'}
          </p>
          <p>
            <strong>Marcador:</strong> {partido.marcadorLocal} - {partido.marcadorVisitante}
          </p>
        </div>
      )}
    </div>
  );
};