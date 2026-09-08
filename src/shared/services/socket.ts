import { io } from 'socket.io-client';

/**
 * Cliente de Socket.IO compartido, mismo patrón que Overtime-Partido
 * (src/services/socket.ts): un singleton con `autoConnect: false` — quien lo necesite
 * (por ahora, la captura simultánea de "Mi planilla") lo conecta y desconecta explícitamente,
 * en vez de abrir una conexión apenas carga la app.
 */
const API_BASE_URL = process.env.REACT_APP_API_URL ?? 'https://overtime-ddyl.onrender.com/api';
const URL = API_BASE_URL.replace(/\/api\/?$/, '');

export const socket = io(URL, {
  autoConnect: false,
  transports: ['websocket'],
});
