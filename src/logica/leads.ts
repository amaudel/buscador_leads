import type { EstadoLead, Lead } from '../../shared/tipos';
import { repo } from '../datos';

export async function asegurarLead(negocioId: string, estado: EstadoLead = 'nuevo'): Promise<Lead> {
  const actual = await repo.obtenerLead(negocioId);
  if (actual) return actual;
  const ahora = new Date().toISOString();
  const l: Lead = { negocioId, estado, notas: '', proximaAccion: null, creado: ahora, actualizado: ahora };
  await repo.guardarLead(l);
  return l;
}

export async function actualizarLead(negocioId: string, cambios: Partial<Omit<Lead, 'negocioId'>>) {
  const l = await asegurarLead(negocioId);
  await repo.guardarLead({ ...l, ...cambios, actualizado: new Date().toISOString() });
}

export async function guardarVarios(ids: string[]) {
  for (const id of ids) await asegurarLead(id);
}
