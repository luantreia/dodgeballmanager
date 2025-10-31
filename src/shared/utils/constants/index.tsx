// src/utils/constants/index.js
// Constantes centralizadas de la aplicación

// Configuración de paginación
export const ITEMS_PER_PAGE = 20;
export const MAX_ITEMS_PER_PAGE = 100;

// Estados de carga
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

// Tipos de equipos
export const EQUIPO_TYPES = {
  SELECCION: 'seleccion',
  CLUB: 'club',
  TODOS: 'todos'
};

// Estados de partido
export const PARTIDO_ESTADOS = {
  PROGRAMADO: 'programado',
  EN_VIVO: 'en_vivo',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado'
};

// Modos de estadísticas
export const ESTADISTICAS_MODOS = {
  AUTOMATICO: 'automatico',
  MANUAL: 'manual',
  MIXTO: 'mixto'
};

// Configuración de API
export const API_CONFIG = {
  BASE_URL: 'https://overtime-ddyl.onrender.com',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3
};

// Rutas principales
export const ROUTES = {
  HOME: '/',
  EQUIPOS: '/equipos',
  JUGADORES: '/jugadores',
  PARTIDOS: '/partidos',
  COMPETENCIAS: '/competencias',
  ORGANIZACIONES: '/organizaciones',
  PERFIL: '/perfil',
  ADMIN: '/admin'
};

// Mensajes de error comunes
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.',
  UNAUTHORIZED: 'No tienes permisos para realizar esta acción.',
  NOT_FOUND: 'El recurso solicitado no fue encontrado.',
  SERVER_ERROR: 'Error interno del servidor. Intenta nuevamente.',
  VALIDATION_ERROR: 'Los datos ingresados no son válidos.'
};

// Configuración de tema
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Breakpoints responsivos (para consistencia)
export const BREAKPOINTS = {
  XS: '475px',
  SM: '640px',
  MD: '768px',
  LG: '1024px',
  XL: '1280px',
  '2XL': '1536px'
};

// Validaciones comunes
export const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[\d\s]+$/,
  MIN_PASSWORD_LENGTH: 8,
  MAX_NAME_LENGTH: 100
};
