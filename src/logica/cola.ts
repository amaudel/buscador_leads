/** Ejecuta tareas con concurrencia limitada; un fallo no detiene las demás. */
export async function enCola<T>(
  elementos: T[],
  tarea: (e: T, i: number) => Promise<void>,
  concurrencia = 2,
): Promise<void> {
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < elementos.length) {
      const i = siguiente++;
      try {
        await tarea(elementos[i], i);
      } catch {
        /* el error se gestiona dentro de la tarea */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrencia, elementos.length) }, trabajador));
}
