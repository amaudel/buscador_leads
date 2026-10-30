// Contraseña de Treg (TREG_ACCESS_KEY) solo en memoria: sobrevive al navegar entre
// pantallas, se borra al recargar o cerrar la pestaña. Nunca en localStorage.
import { create } from 'zustand';

export const useClaveTreg = create<{ clave: string; setClave: (c: string) => void }>((set) => ({
  clave: '',
  setClave: (clave) => set({ clave }),
}));
