import { useState } from 'react';

export const GLOSARIO: Record<string, string> = {
  oportunidad: 'Nota de 0 a 100 de qué tan buen cliente puede ser: sube si no tiene web, si su web es mala o si el negocio es activo (muchas reseñas). Toca el número para ver el porqué.',
  pagespeed: 'Herramienta gratuita de Google que mide qué tan rápida y bien hecha está una web en el celular (0 a 100).',
  sri: 'Catastro RUC del SRI (datos abiertos). Si el negocio es de una persona natural, la razón social es el nombre del dueño. Gratis.',
  treg: 'Servicio de pago (centavos por consulta) que busca el correo de trabajo de una persona en una empresa con web propia.',
  personaNatural: 'Negocio registrado a nombre de una persona (no de una compañía). Su razón social es el nombre del dueño.',
  webPropia: 'Tiene su propio dominio (ej. clinicaxyz.com). Facebook, Instagram o Linktree no cuentan como web propia.',
};

/** Icono «?» con una explicación corta al tocarlo o pasar el ratón. */
export function Ayuda({ termino, texto }: { termino?: keyof typeof GLOSARIO; texto?: string }) {
  const [abierta, setAbierta] = useState(false);
  const contenido = texto ?? (termino ? GLOSARIO[termino] : '');
  return (
    <span className="ayuda" onMouseEnter={() => setAbierta(true)} onMouseLeave={() => setAbierta(false)}>
      <button type="button" className="ayuda-boton" aria-label="Ayuda" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAbierta(!abierta); }}>
        ?
      </button>
      {abierta && <span className="ayuda-pop" role="tooltip">{contenido}</span>}
    </span>
  );
}
