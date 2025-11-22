import React, { useEffect, useState } from 'react';
import { useSolicitudes } from '../context/SolicitudesContext';
import { useToast } from '../../../components/Toast/ToastProvider';
import {
  ISolicitudContexto,
  ISolicitudOpciones,
  ISolicitudCrearPayload,
  SolicitudEdicionTipo,
} from '../types/solicitudesEdicion';
import ModalBase from '../../../components/ModalBase/ModalBase';

interface SolicitudModalProps {
  isOpen: boolean;
  contexto?: ISolicitudContexto;
  onClose: () => void;
  onSuccess?: () => void;
  prefillTipo?: SolicitudEdicionTipo;
  prefillDatos?: Record<string, any>;
}

/**
 * Modal para crear solicitudes de edición
 * Carga dinámicamente las opciones según el contexto
 */
export const SolicitudModal: React.FC<SolicitudModalProps> = ({
  isOpen,
  contexto,
  onClose,
  onSuccess,
  prefillTipo,
  prefillDatos,
}) => {
  const {
    solicitudActual,
    cargarOpciones,
    crearSolicitud,
    creandoSolicitud,
    error,
    limpiarError,
  } = useSolicitudes();

  const { addToast } = useToast();

  const [tipoSeleccionado, setTipoSeleccionado] = useState<SolicitudEdicionTipo | ''>(prefillTipo ?? '');
  const [datosPropuestos, setDatosPropuestos] = useState<Record<string, any>>(prefillDatos ?? {});

  // Cargar opciones cuando se abre el modal
  useEffect(() => {
    if (isOpen && contexto) {
      cargarOpciones(contexto);
    }
  }, [isOpen, contexto, cargarOpciones]);

  // Limpiar errores cuando se cierra
  useEffect(() => {
    if (!isOpen) {
      limpiarError();
      setTipoSeleccionado(prefillTipo ?? '');
      setDatosPropuestos(prefillDatos ?? {});
    }
  }, [isOpen, limpiarError, prefillTipo, prefillDatos]);

  // If prefill props change while open, update local state
  useEffect(() => {
    if (isOpen) {
      if (prefillTipo) setTipoSeleccionado(prefillTipo);
      if (prefillDatos) setDatosPropuestos((prev) => ({ ...prev, ...prefillDatos }));
    }
  }, [prefillTipo, JSON.stringify(prefillDatos), isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tipoSeleccionado) {
      addToast({
        type: 'error',
        title: 'Validación',
        message: 'Debe seleccionar un tipo de solicitud',
      });
      return;
    }

    try {
      const payload: ISolicitudCrearPayload = {
        tipo: tipoSeleccionado as SolicitudEdicionTipo,
        entidad: contexto?.entidadId || undefined,
        datosPropuestos,
      };

      await crearSolicitud(payload);

      addToast({
        type: 'success',
        title: 'Éxito',
        message: 'Solicitud creada exitosamente',
      });

      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Error al crear solicitud',
      });
    }
  };

  const opciones = solicitudActual.opciones || [];
  const tipoSeleccionadoMeta = opciones.find((o: ISolicitudOpciones) => o.tipo === tipoSeleccionado)?.meta;

  return (
    <>
      <ModalBase isOpen={isOpen} onClose={onClose} title="Nueva Solicitud de Edición">
        <div className="space-y-6">
          {/* Selector de tipo de solicitud. Si el modal fue abierto con prefillTipo, mostrarlo fijo y no permitir cambiarlo */}
          {prefillTipo ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Solicitud</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                {formatearTipo(prefillTipo)}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Solicitud
              </label>
              <select
                value={tipoSeleccionado}
                onChange={(e) => {
                  setTipoSeleccionado(e.target.value as SolicitudEdicionTipo);
                  setDatosPropuestos({});
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecciona una opción...</option>
                {opciones.map((opcion: ISolicitudOpciones) => (
                  <option key={opcion.tipo} value={opcion.tipo}>
                    {formatearTipo(opcion.tipo)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Información de campos críticos */}
          {tipoSeleccionadoMeta && tipoSeleccionadoMeta.camposCriticos.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-700">
                <strong>Campos críticos:</strong> {tipoSeleccionadoMeta.camposCriticos.join(', ')}
              </p>
              {tipoSeleccionadoMeta.requiereDobleConfirmacion && (
                <p className="text-sm text-yellow-700 mt-1">
                  ⚠️ Esta solicitud requiere doble confirmación
                </p>
              )}
            </div>
          )}

          {/* Formulario dinámico según tipo */}
          {tipoSeleccionado && (
            <FormularioSolicitudDinamico
              tipo={tipoSeleccionado}
              valores={datosPropuestos}
              onChange={setDatosPropuestos}
            />
          )}

          {/* Error global */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              disabled={creandoSolicitud}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={creandoSolicitud || !tipoSeleccionado}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {creandoSolicitud ? 'Creando...' : 'Crear Solicitud'}
            </button>
          </div>
        </div>
      </ModalBase>
    </>
  );
};

/**
 * Componente dinámico para renderizar formularios según tipo de solicitud
 */
interface FormularioSolicitudDinamicoProps {
  tipo: SolicitudEdicionTipo;
  valores: Record<string, any>;
  onChange: (valores: Record<string, any>) => void;
}

const FormularioSolicitudDinamico: React.FC<FormularioSolicitudDinamicoProps> = ({
  tipo,
  valores,
  onChange,
}) => {
  const handleChange = (field: string, value: any) => {
    onChange({ ...valores, [field]: value });
  };

  // Renderizar campos según el tipo de solicitud
  switch (tipo) {
    case 'jugador-equipo-crear':
      return (
        <div className="space-y-4">
          {/* If jugadorId/equipoId were prefilled (from InvitarJugadorSection), show them as read-only to avoid accidental edits */}
          {/* Jugador: mostrar nombre/alias si vienen en prefill, sino mostrar ID o input editable */}
          {valores.jugadorNombre ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jugador</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                <div className="font-medium">{valores.jugadorNombre}</div>
                {valores.jugadorAlias ? <div className="text-xs text-slate-500">Alias: {valores.jugadorAlias}</div> : null}
                {valores.jugadorId ? <div className="text-xs text-slate-400 mt-1">ID: {valores.jugadorId}</div> : null}
              </div>
            </div>
          ) : valores.jugadorId ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jugador</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">{valores.jugadorId}</div>
            </div>
          ) : (
            <InputField
              label="ID del Jugador"
              value={valores.jugadorId || ''}
              onChange={(v) => handleChange('jugadorId', v)}
              required
            />
          )}

          {/* Equipo: mostrar nombre si viene en prefill, sino mostrar ID o input editable */}
          {valores.equipoNombre ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipo</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
            <div className="font-medium">{valores.equipoNombre}</div>
            {valores.equipoId ? <div className="text-xs text-slate-400 mt-1">ID: {valores.equipoId}</div> : null}
              </div>
            </div>
          ) : valores.equipoId ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipo</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">{valores.equipoId}</div>
            </div>
          ) : (
            <InputField
              label="ID del Equipo"
              value={valores.equipoId || ''}
              onChange={(v) => handleChange('equipoId', v)}
              required
            />
          )}
          <SelectField
            label="Rol"
            value={valores.rol || 'jugador'}
            options={[
              { value: 'jugador', label: 'Jugador' },
              { value: 'entrenador', label: 'Entrenador' },
            ]}
            onChange={(v) => handleChange('rol', v)}
            required
          />
          <InputField
            label="Fecha de Inicio (opcional)"
            type="date"
            value={valores.fechaInicio || ''}
            onChange={(v) => handleChange('fechaInicio', v)}
          />
          <InputField
            label="Fecha de Fin (opcional)"
            type="date"
            value={valores.fechaFin || ''}
            onChange={(v) => handleChange('fechaFin', v)}
          />
        </div>
      );

    case 'jugador-equipo-eliminar':
      return (
        <div className="space-y-4">
          <InputField
            label="ID del Contrato"
            value={valores.contratoId || ''}
            onChange={(v) => handleChange('contratoId', v)}
            required
            placeholder="ID de JugadorEquipo"
          />
        </div>
      );

    case 'participacion-temporada-crear':
      return (
        <div className="space-y-4">
          <InputField
            label="ID del Equipo"
            value={valores.equipoId || ''}
            onChange={(v) => handleChange('equipoId', v)}
            required
          />
          <InputField
            label="ID de la Temporada"
            value={valores.temporadaId || ''}
            onChange={(v) => handleChange('temporadaId', v)}
            required
          />
          <SelectField
            label="Estado"
            value={valores.estado || 'activo'}
            options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
              { value: 'suspendido', label: 'Suspendido' },
            ]}
            onChange={(v) => handleChange('estado', v)}
          />
          <TextAreaField
            label="Observaciones (opcional)"
            value={valores.observaciones || ''}
            onChange={(v) => handleChange('observaciones', v)}
          />
        </div>
      );

    case 'usuario-crear-equipo':
      return (
        <div className="space-y-4">
          <InputField
            label="Nombre del Equipo"
            value={valores.nombre || ''}
            onChange={(v) => handleChange('nombre', v)}
            required
          />
          <InputField
            label="Tipo (opcional)"
            value={valores.tipo || ''}
            onChange={(v) => handleChange('tipo', v)}
            placeholder="ej: profesional, amateur"
          />
          <InputField
            label="País (opcional)"
            value={valores.pais || ''}
            onChange={(v) => handleChange('pais', v)}
          />
          <InputField
            label="Descripción (opcional)"
            value={valores.descripcion || ''}
            onChange={(v) => handleChange('descripcion', v)}
          />
          <InputField
            label="Sitio Web (opcional)"
            type="url"
            value={valores.sitioWeb || ''}
            onChange={(v) => handleChange('sitioWeb', v)}
          />
        </div>
      );

    case 'usuario-crear-jugador':
      return (
        <div className="space-y-4">
          <InputField
            label="Nombre"
            value={valores.nombre || ''}
            onChange={(v) => handleChange('nombre', v)}
            required
          />
          <InputField
            label="Alias (opcional)"
            value={valores.alias || ''}
            onChange={(v) => handleChange('alias', v)}
          />
          <InputField
            label="Fecha de Nacimiento"
            type="date"
            value={valores.fechaNacimiento || ''}
            onChange={(v) => handleChange('fechaNacimiento', v)}
            required
          />
          <SelectField
            label="Género (opcional)"
            value={valores.genero || ''}
            options={[
              { value: '', label: 'No especificado' },
              { value: 'masculino', label: 'Masculino' },
              { value: 'femenino', label: 'Femenino' },
              { value: 'otro', label: 'Otro' },
            ]}
            onChange={(v) => handleChange('genero', v)}
          />
          <InputField
            label="Nacionalidad (opcional)"
            value={valores.nacionalidad || ''}
            onChange={(v) => handleChange('nacionalidad', v)}
          />
        </div>
      );

    case 'jugador-equipo-editar':
      return (
        <div className="space-y-4">
          <SelectField
            label="Rol"
            value={valores.rol || 'jugador'}
            options={[
              { value: 'jugador', label: 'Jugador' },
              { value: 'entrenador', label: 'Entrenador' },
            ]}
            onChange={(v) => handleChange('rol', v)}
            required
          />
          <InputField
            label="Fecha de Inicio (opcional)"
            type="date"
            value={valores.fechaInicio || ''}
            onChange={(v) => handleChange('fechaInicio', v)}
          />
          <InputField
            label="Fecha de Fin (opcional)"
            type="date"
            value={valores.fechaFin || ''}
            onChange={(v) => handleChange('fechaFin', v)}
          />
          <SelectField
            label="Estado"
            value={valores.estado || 'activo'}
            options={[
              { value: 'activo', label: 'Activo' },
              { value: 'baja', label: 'Baja' },
            ]}
            onChange={(v) => handleChange('estado', v)}
          />
          <InputField
            label="Foto (URL)"
            value={valores.foto || ''}
            onChange={(v) => handleChange('foto', v)}
          />
        </div>
      );

    default:
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <p className="text-sm text-gray-600">
            Formulario no disponible para este tipo de solicitud
          </p>
        </div>
      );
  }
};

/**
 * Componentes de entrada reutilizables
 */
interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (value: any) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

interface SelectFieldProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  required?: boolean;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  options,
  onChange,
  required,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  value,
  onChange,
  required,
  placeholder,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

/**
 * Utilidad para formatear tipos de solicitud
 */
function formatearTipo(tipo: string): string {
  const mapa: Record<string, string> = {
    'jugador-equipo-crear': 'Agregar Jugador al Equipo',
    'jugador-equipo-eliminar': 'Remover Jugador del Equipo',
    'participacion-temporada-crear': 'Inscribir Equipo en Temporada',
    'participacion-temporada-actualizar': 'Actualizar Participación en Temporada',
    'participacion-temporada-eliminar': 'Remover Equipo de Temporada',
    'jugador-temporada-crear': 'Agregar Jugador a Temporada',
    'jugador-temporada-actualizar': 'Actualizar Jugador en Temporada',
    'jugador-temporada-eliminar': 'Remover Jugador de Temporada',
    'usuario-crear-equipo': 'Crear Nuevo Equipo',
    'usuario-crear-jugador': 'Crear Nuevo Jugador',
    'usuario-crear-organizacion': 'Crear Nueva Organización',
    'usuario-solicitar-admin-equipo': 'Solicitar Administración de Equipo',
    'usuario-solicitar-admin-jugador': 'Solicitar Administración de Jugador',
    'usuario-solicitar-admin-organizacion': 'Solicitar Administración de Organización',
  };
  return mapa[tipo] || tipo;
}

export default SolicitudModal;