export function aCsv(filas: Record<string, unknown>[]): string {
  if (!filas.length) return '';
  const cols = Object.keys(filas[0]);
  const celda = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(';'), ...filas.map((f) => cols.map((c) => celda(f[c])).join(';'))].join('\r\n');
}

export function descargarCsv(nombre: string, filas: Record<string, unknown>[]) {
  // BOM para que Excel reconozca UTF-8; «;» como separador (Excel en español).
  const blob = new Blob(['﻿' + aCsv(filas)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
