import { useEffect, useState } from 'react';

/**
 * Barra fija que avisa cuando el dispositivo perdió la conexión.
 *
 * La app no tiene service worker ni caché de queries: sin red, cada pantalla falla con un toast
 * rojo genérico y no hay forma de distinguir "el backend está caído" de "el gimnasio no tiene
 * señal". Este cartel no arregla el offline —eso pide una capa de caché, como la que ya usa
 * Overtime-Public con TanStack Query— pero al menos le dice al DT por qué no le carga nada y
 * que lo que tiene en pantalla no se va a poder guardar todavía.
 */
const IndicadorSinConexion = () => {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    window.addEventListener('online', marcarOnline);
    window.addEventListener('offline', marcarOffline);
    return () => {
      window.removeEventListener('online', marcarOnline);
      window.removeEventListener('offline', marcarOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white"
    >
      Sin conexión. Vas a poder seguir mirando lo que ya está en pantalla, pero nada se guarda
      hasta que vuelva la señal.
    </div>
  );
};

export default IndicadorSinConexion;
