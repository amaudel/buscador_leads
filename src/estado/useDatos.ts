import { useEffect, useState } from 'react';
import { cambios } from '../datos';

/** Ejecuta una consulta al repositorio y la repite cuando cambian los datos. */
export function useDatos<T>(consulta: () => Promise<T>, deps: unknown[]): { datos: T | undefined; cargando: boolean } {
  const [estado, setEstado] = useState<{ datos: T | undefined; cargando: boolean }>({ datos: undefined, cargando: true });
  useEffect(() => {
    let vivo = true;
    const ejecutar = () =>
      consulta().then((datos) => {
        if (vivo) setEstado({ datos, cargando: false });
      });
    ejecutar();
    const quitar = cambios.suscribir(ejecutar);
    return () => {
      vivo = false;
      quitar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return estado;
}
