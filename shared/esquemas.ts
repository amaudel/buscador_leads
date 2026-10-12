// Esquemas de las respuestas de Gemini: validan la salida (zod) y se envían
// como responseJsonSchema para obtener JSON estructurado.
import { z } from 'zod';

const estadoCheck = z.enum(['si', 'no', 'desconocido']);
const itemCheck = z.object({
  estado: estadoCheck,
  detalle: z.string().describe('Explicación breve de lo observado'),
});

export const tipoServicio = z.enum(['web_nueva', 'mejora_web', 'agente_whatsapp', 'sistema_citas', 'app_web']);

export const esquemaAnalisisWeb = z.object({
  resumen: z.string().describe('A qué se dedica el negocio, exactamente en dos frases'),
  checklist: z.object({
    https: itemCheck,
    adaptadaMovil: itemCheck,
    botonWhatsapp: itemCheck,
    citaOnline: itemCheck.describe('Reserva o cita online'),
    formularioContacto: itemCheck,
    desactualizada: itemCheck.describe('«si» si hay señales de web desactualizada (año del copyright antiguo, diseño viejo, enlaces rotos)'),
  }),
  correos: z.array(z.string()).describe('Correos electrónicos que aparecen en la web'),
  redes: z.array(z.object({ red: z.string(), url: z.string() })).describe('Redes sociales enlazadas en la web'),
  problemas: z
    .array(z.object({ titulo: z.string(), explicacion: z.string() }))
    .describe('Entre 3 y 5 problemas explicados en lenguaje llano'),
  servicio: z.object({
    tipo: tipoServicio,
    porque: z.string().describe('Por qué este servicio le conviene a este negocio'),
  }),
});

export const esquemaAnalisisSinWeb = z.object({
  resumen: z.string().describe('A qué se dedica el negocio, exactamente en dos frases'),
  problemas: z
    .array(z.object({ titulo: z.string(), explicacion: z.string() }))
    .describe('Entre 3 y 5 problemas u oportunidades perdidas por no tener web propia'),
  servicio: z.object({ tipo: tipoServicio, porque: z.string() }),
});

export const esquemaBorradores = z.object({
  llamada: z.string().describe('Guion de llamada de unos 30 segundos (70-85 palabras)'),
  whatsapp: z.string().describe('Mensaje de WhatsApp breve y personal'),
  correo: z.object({ asunto: z.string(), cuerpo: z.string() }),
});

export const esquemaNichos = z.object({
  ranking: z
    .array(
      z.object({
        categoria: z.string(),
        puntuacion: z.number().describe('Oportunidad de 0 a 100'),
        porque: z.string(),
        servicio: tipoServicio,
      }),
    )
    .describe('Todas las categorías, ordenadas de mayor a menor oportunidad'),
  conclusion: z.string().describe('Recomendación final sobre las tres mejores categorías'),
});

/** JSON Schema para el campo responseJsonSchema de Gemini. */
export function aJsonSchema(esquema: z.ZodType): Record<string, unknown> {
  const { $schema: _omit, ...resto } = z.toJSONSchema(esquema) as Record<string, unknown>;
  return resto;
}
