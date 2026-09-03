/**
 * Esta ruta era una segunda copia, escrita a mano, de los tipos de solicitudes de edición. Las
 * dos versiones ya habían divergido (a esta le faltaban `ISolicitudAprobadores`, `SolicitudEdicion`
 * y varios campos de `ISolicitudOpciones`), y como cada consumidor importaba de una u otra según
 * el archivo, un tipo arreglado en una seguía roto en la otra.
 *
 * La fuente de verdad ahora es `shared/features/solicitudes/types/solicitudesEdicion.ts`, junto a
 * los servicios que producen estos datos. Esto queda sólo como alias para no tocar los imports
 * existentes; en código nuevo importá directo desde `shared/features/solicitudes`.
 */
export * from '../../features/solicitudes/types/solicitudesEdicion';
