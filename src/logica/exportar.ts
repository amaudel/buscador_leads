// Exportación del listado de Buscar a Excel (.xlsx) y PDF.
// Las librerías se cargan solo al exportar para no engordar la app.
import { ESTADOS, SERVICIOS, type Analisis, type Lead, type Negocio } from '../../shared/tipos';
import { etiquetaWeb } from './clasificarWeb';
import { puntuar } from './puntuacion';

export interface FilaExportable {
  n: Negocio;
  lead?: Lead;
  analisis?: Analisis;
}

const ESTADO_NEGOCIO: Record<string, string> = {
  OPERATIONAL: 'Abierto',
  CLOSED_TEMPORARILY: 'Cerrado temporalmente',
  CLOSED_PERMANENTLY: 'Cerrado definitivamente',
};

/** Columnas del Excel: todos los datos que tiene la app del negocio. */
const COLUMNAS: { titulo: string; ancho: number; valor: (f: FilaExportable) => string | number | null }[] = [
  { titulo: 'Nombre', ancho: 34, valor: (f) => f.n.nombre },
  { titulo: 'Categoría', ancho: 26, valor: (f) => f.n.dedicacion },
  { titulo: 'Dirección', ancho: 44, valor: (f) => f.n.direccion },
  { titulo: 'Teléfono', ancho: 16, valor: (f) => f.n.telNacional },
  { titulo: 'Teléfono internacional', ancho: 20, valor: (f) => f.n.telInternacional },
  { titulo: 'WhatsApp', ancho: 30, valor: (f) => (f.n.telInternacional ? `https://wa.me/${f.n.telInternacional.replace(/\D/g, '')}` : null) },
  { titulo: 'Web', ancho: 36, valor: (f) => f.n.web },
  { titulo: 'Tipo de web', ancho: 15, valor: (f) => etiquetaWeb(f.n.tipoWeb) },
  { titulo: 'Valoración', ancho: 11, valor: (f) => f.n.valoracion },
  { titulo: 'Reseñas', ancho: 9, valor: (f) => f.n.numResenas },
  { titulo: 'Estado del negocio', ancho: 18, valor: (f) => (f.n.estadoNegocio ? ESTADO_NEGOCIO[f.n.estadoNegocio] ?? f.n.estadoNegocio : null) },
  { titulo: 'Oportunidad', ancho: 12, valor: (f) => puntuar(f.n, f.analisis).total },
  { titulo: 'Oportunidad provisional', ancho: 12, valor: (f) => (puntuar(f.n, f.analisis).provisional ? 'Sí' : 'No') },
  { titulo: 'Por qué', ancho: 60, valor: (f) => puntuar(f.n, f.analisis).desglose.slice(1).map((d) => `${d.motivo} (${d.puntos > 0 ? '+' : ''}${d.puntos})`).join('; ') },
  { titulo: 'PageSpeed rendimiento', ancho: 12, valor: (f) => f.analisis?.pagespeed?.notas.performance ?? null },
  { titulo: 'PageSpeed SEO', ancho: 10, valor: (f) => f.analisis?.pagespeed?.notas.seo ?? null },
  { titulo: 'A qué se dedica (IA)', ancho: 60, valor: (f) => f.analisis?.gemini?.resumen ?? null },
  { titulo: 'Servicio recomendado', ancho: 24, valor: (f) => (f.analisis?.gemini ? SERVICIOS[f.analisis.gemini.servicio.tipo] ?? f.analisis.gemini.servicio.tipo : null) },
  { titulo: 'Correos', ancho: 30, valor: (f) => f.analisis?.gemini?.correos.join(', ') || null },
  { titulo: 'Redes', ancho: 40, valor: (f) => f.analisis?.gemini?.redes.map((r) => r.url).join(' ') || null },
  { titulo: 'Estado del lead', ancho: 14, valor: (f) => (f.lead ? ESTADOS.find((e) => e.id === f.lead!.estado)?.etiqueta ?? f.lead.estado : 'No guardado') },
  { titulo: 'Notas', ancho: 40, valor: (f) => f.lead?.notas || null },
  { titulo: 'Google Maps', ancho: 40, valor: (f) => f.n.mapsUrl },
  { titulo: 'Latitud', ancho: 11, valor: (f) => f.n.ubicacion?.lat ?? null },
  { titulo: 'Longitud', ancho: 11, valor: (f) => f.n.ubicacion?.lng ?? null },
  { titulo: 'Nicho', ancho: 22, valor: (f) => f.n.nicho },
  { titulo: 'Zona', ancho: 22, valor: (f) => f.n.zona },
];

export function nombreArchivo(nicho: string, zona: string, ext: string): string {
  const limpio = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `negocios-${limpio(nicho)}-${limpio(zona)}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

/** Filas en forma de tabla (cabecera + datos), útil para Excel y pruebas. */
export function tablaExportable(filas: FilaExportable[]): (string | number | null)[][] {
  return [COLUMNAS.map((c) => c.titulo), ...filas.map((f) => COLUMNAS.map((c) => c.valor(f)))];
}

export async function exportarExcel(filas: FilaExportable[], nicho: string, zona: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const [cabecera, ...datos] = tablaExportable(filas);
  const hoja = [
    cabecera.map((t) => ({ value: String(t), fontWeight: 'bold' as const, backgroundColor: '#D9F56B', wrap: true })),
    ...datos.map((fila) =>
      fila.map((v) => (v == null || v === '' ? null : typeof v === 'number' ? { value: v, type: Number } : { value: v, type: String })),
    ),
  ];
  await writeXlsxFile(hoja, {
    sheet: 'Negocios',
    columns: COLUMNAS.map((c) => ({ width: c.ancho })),
    stickyRowsCount: 1,
  }).toFile(nombreArchivo(nicho, zona, 'xlsx'));
}

export async function exportarPdf(filas: FilaExportable[], nicho: string, zona: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fecha = new Date().toLocaleDateString('es-419', { day: '2-digit', month: 'long', year: 'numeric' });
  const sinWeb = filas.filter((f) => f.n.tipoWeb !== 'propia').length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titulo = `${nicho} en ${zona}`;
  doc.text(titulo.charAt(0).toUpperCase() + titulo.slice(1), 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text(`${filas.length} negocios · ${sinWeb} sin web propia · Radar de Clientes · ${fecha}`, 14, 22);

  const enlaces: (string | null)[][] = [];
  autoTable(doc, {
    startY: 27,
    head: [['#', 'Negocio', 'Dirección', 'Teléfono', 'Web', 'Valoración', 'Oport.', 'Servicio / estado']],
    body: filas.map((f, i) => {
      const p = puntuar(f.n, f.analisis);
      const web = f.n.tipoWeb === 'propia' && f.n.web ? f.n.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : etiquetaWeb(f.n.tipoWeb);
      enlaces.push([null, f.n.mapsUrl, f.n.mapsUrl, null, f.n.web, null, null, null]);
      return [
        String(i + 1),
        `${f.n.nombre}\n${f.n.dedicacion ?? ''}`,
        f.n.direccion ?? '—',
        [f.n.telNacional, f.n.telInternacional].filter(Boolean).join('\n') || '—',
        web,
        f.n.valoracion != null ? `${f.n.valoracion.toFixed(1)} (${f.n.numResenas})` : '—',
        `${p.total}${p.provisional ? '*' : ''}`,
        [
          f.analisis?.gemini ? SERVICIOS[f.analisis.gemini.servicio.tipo] : null,
          f.lead ? ESTADOS.find((e) => e.id === f.lead!.estado)?.etiqueta : null,
        ].filter(Boolean).join(' · ') || '—',
      ];
    }),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: [20, 20, 20], textColor: [217, 245, 107], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 246, 244] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'right', textColor: 120 },
      1: { cellWidth: 58, fontStyle: 'bold' },
      2: { cellWidth: 62 },
      3: { cellWidth: 32 },
      4: { cellWidth: 42 },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 'auto' },
    },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const web = d.column.index === 4 && filas[d.row.index]?.n.tipoWeb !== 'propia';
      if (web) d.cell.styles.textColor = [200, 60, 50];
      if (d.column.index === 6) {
        const v = parseInt(String(d.cell.raw), 10);
        d.cell.styles.textColor = v >= 70 ? [30, 125, 69] : v >= 45 ? [178, 106, 0] : [192, 57, 43];
      }
    },
    didDrawCell: (d) => {
      // Nombre y dirección enlazan a Google Maps; la web, a la web.
      const url = d.section === 'body' ? enlaces[d.row.index]?.[d.column.index] : null;
      if (url) doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url });
    },
    didDrawPage: () => {
      const pagina = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(
        `Página ${pagina} · * oportunidad provisional (solo datos de Google Maps) · Nombre y dirección enlazan a Google Maps`,
        14,
        doc.internal.pageSize.getHeight() - 7,
      );
    },
  });

  doc.save(nombreArchivo(nicho, zona, 'pdf'));
}
