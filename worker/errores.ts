export class ErrorApi extends Error {
  constructor(
    public origen: string,
    public estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/** Lanza ErrorApi con el mensaje real de una API de Google si la respuesta no es correcta. */
export async function comprobar(res: Response, origen: string): Promise<unknown> {
  const texto = await res.text();
  let datos: unknown = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    /* respuesta no JSON */
  }
  if (!res.ok) {
    const msg =
      (datos as { error?: { message?: string } } | null)?.error?.message ??
      (texto.slice(0, 500) || res.statusText || 'Error desconocido');
    throw new ErrorApi(origen, res.status, msg);
  }
  return datos;
}
