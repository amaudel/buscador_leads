// Ajustes y contador de uso: localStorage (solo en este navegador).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PerfilVendedor } from '../../shared/tipos';

export interface Ajustes {
  claveGoogle: string;
  regionCode: string;
  perfil: PerfilVendedor;
  limiteMensual: number;
  umbralAviso: number;
  modeloGemini: string; // vacío = automático
  usoPlaces: Record<string, number>; // 'AAAA-MM' -> llamadas
}

interface Acciones {
  cambiar: (p: Partial<Ajustes>) => void;
  cambiarPerfil: (p: Partial<PerfilVendedor>) => void;
  sumarLlamadaPlaces: (n?: number) => void;
}

export const mesActual = () => new Date().toISOString().slice(0, 7);

export const useAjustes = create<Ajustes & Acciones>()(
  persist(
    (set) => ({
      claveGoogle: '',
      regionCode: 'ES',
      perfil: { nombre: '', queVendo: '', propuesta: '', tono: 'profesional' },
      limiteMensual: 1000,
      umbralAviso: 800,
      modeloGemini: '',
      usoPlaces: {},
      cambiar: (p) => set(p),
      cambiarPerfil: (p) => set((s) => ({ perfil: { ...s.perfil, ...p } })),
      sumarLlamadaPlaces: (n = 1) =>
        set((s) => {
          const mes = mesActual();
          return { usoPlaces: { ...s.usoPlaces, [mes]: (s.usoPlaces[mes] ?? 0) + n } };
        }),
    }),
    { name: 'radar-ajustes', version: 1 },
  ),
);

export function usoDelMes(a: Pick<Ajustes, 'usoPlaces'>): number {
  return a.usoPlaces[mesActual()] ?? 0;
}
