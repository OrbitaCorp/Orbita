// El reloj de la oferta relámpago como fichas de calendario que giran
// (split-flap): cada unidad —días, horas, minutos, segundos— es una tarjeta
// partida al medio; cuando el valor cambia, la mitad de arriba cae mostrando
// el número viejo y la de abajo sube con el nuevo. Ale (08/09): "hojitas tipo
// calendario que se van dando vueltas".
//
// Sin estado ni efectos: como es una cuenta REGRESIVA, el valor anterior de
// cada unidad es siempre el siguiente en el ciclo (07 venía de 08; 00 seg de
// 59). Las dos mitades que giran llevan `key={valor}`, así se vuelven a montar
// —y la animación arranca de cero— solo cuando esa unidad cambia. El resto
// del tiempo quedan quietas mostrando el valor actual.
//
// Va aria-hidden: quien lo monta tiene que dar la fecha de fin en texto para
// lectores de pantalla (anunciar los segundos taparía la página entera).

type Props = {
  restanteMs: number
  // 'md' es el de la cartelera de la portada; 'sm' entra en un banner.
  tamano?: 'md' | 'sm'
}

function partes(ms: number) {
  const seg = Math.max(0, Math.floor(ms / 1000))
  return {
    dias: Math.floor(seg / 86400),
    horas: Math.floor((seg % 86400) / 3600),
    min: Math.floor((seg % 3600) / 60),
    seg: seg % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function FlipReloj({ restanteMs, tamano = 'md' }: Props) {
  const t = partes(restanteMs)
  return (
    <div className={`sf-flip sf-flip--${tamano}`} aria-hidden="true">
      <style>{ESTILOS}</style>
      {/* Los días solo si faltan: en las últimas horas un "00 días" al lado
          del resto le baja la urgencia justo cuando más la tiene. */}
      {t.dias > 0 && <Ficha valor={t.dias} anterior={t.dias + 1} label={t.dias === 1 ? 'día' : 'días'} />}
      <Ficha valor={t.horas} anterior={(t.horas + 1) % 24} label="hs" />
      <Ficha valor={t.min} anterior={(t.min + 1) % 60} label="min" />
      <Ficha valor={t.seg} anterior={(t.seg + 1) % 60} label="seg" />
    </div>
  )
}

function Ficha({ valor, anterior, label }: { valor: number; anterior: number; label: string }) {
  const nuevo = pad(valor)
  const viejo = pad(anterior)
  return (
    <div className="sf-flip-u">
      <div className="sf-flip-card">
        {/* Fijas: arriba ya está el número nuevo (queda a la vista cuando la
            hoja de arriba termina de caer); abajo sigue el viejo hasta que la
            hoja de abajo lo tapa. */}
        <div className="sf-flip-mitad sf-flip-arriba"><span>{nuevo}</span></div>
        <div className="sf-flip-mitad sf-flip-abajo"><span>{viejo}</span></div>
        {/* Las que giran: se vuelven a montar con cada valor (key). */}
        <div key={`a-${nuevo}`} className="sf-flip-mitad sf-flip-arriba sf-flip-cae"><span>{viejo}</span></div>
        <div key={`b-${nuevo}`} className="sf-flip-mitad sf-flip-abajo sf-flip-sube"><span>{nuevo}</span></div>
      </div>
      <span className="sf-flip-label">{label}</span>
    </div>
  )
}

const ESTILOS = `
.sf-flip { display: flex; align-items: flex-start; gap: 10px; }
.sf-flip--md { --sf-flip-h: 66px; --sf-flip-w: 64px; --sf-flip-fs: 34px; --sf-flip-r: 10px; }
.sf-flip--sm { --sf-flip-h: 40px; --sf-flip-w: 38px; --sf-flip-fs: 20px; --sf-flip-r: 7px; gap: 6px; }

.sf-flip-u { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sf-flip--sm .sf-flip-u { gap: 3px; }

/* La tarjeta: un tono más oscuro que el degradé de la cartelera (negro con
   transparencia encima del primario) para que se lea como una ficha apoyada
   y no como otro recuadro del mismo color. El texto hereda color-on-primary. */
.sf-flip-card {
  position: relative; width: var(--sf-flip-w); height: var(--sf-flip-h);
  border-radius: var(--sf-flip-r);
  font-family: "Geist Mono", "Fira Code", monospace;
  font-size: var(--sf-flip-fs); font-weight: 700; line-height: var(--sf-flip-h);
  font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
  perspective: 300px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.20);
}
/* La bisagra. */
.sf-flip-card::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; z-index: 6;
  background: rgba(0,0,0,0.45);
}

.sf-flip-mitad {
  position: absolute; left: 0; width: 100%; height: 50%; overflow: hidden;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
}
.sf-flip-mitad span {
  position: absolute; left: 0; width: 100%; height: var(--sf-flip-h);
  text-align: center; line-height: var(--sf-flip-h);
}
.sf-flip-arriba {
  top: 0; border-radius: var(--sf-flip-r) var(--sf-flip-r) 0 0;
  background: rgba(0,0,0,0.26); transform-origin: bottom center;
  /* Brillo suave en el borde superior: la hoja de arriba recibe la luz. */
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
}
.sf-flip-arriba span { top: 0; }
.sf-flip-abajo {
  bottom: 0; border-radius: 0 0 var(--sf-flip-r) var(--sf-flip-r);
  background: rgba(0,0,0,0.36); transform-origin: top center;
}
/* El número entero mide la tarjeta completa; en la mitad de abajo se lo sube
   media tarjeta para que asome su mitad inferior. */
.sf-flip-abajo span { top: -100%; }

/* La hoja de arriba cae (0 → -90°) mostrando el viejo; después la de abajo
   sube (90° → 0) con el nuevo. Encadenadas por el delay. */
.sf-flip-cae { z-index: 4; animation: sf-flip-caer 300ms ease-in forwards; }
.sf-flip-sube { z-index: 4; transform: rotateX(90deg); animation: sf-flip-subir 300ms 300ms ease-out forwards; }
@keyframes sf-flip-caer { from { transform: rotateX(0deg); } to { transform: rotateX(-90deg); } }
@keyframes sf-flip-subir { from { transform: rotateX(90deg); } to { transform: rotateX(0deg); } }

.sf-flip-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85;
}
.sf-flip--sm .sf-flip-label { font-size: 9px; }

/* Sin movimiento: las fichas cambian de número y listo. La hoja de arriba
   que cae no se muestra; la de abajo queda fija con el valor nuevo. */
@media (prefers-reduced-motion: reduce) {
  .sf-flip-cae { display: none; }
  .sf-flip-sube { animation: none; transform: none; }
}

/* Celular: las fichas se achican para que las cuatro (con días) entren en
   390px con aire. */
@media (max-width: 720px) {
  .sf-flip--md { --sf-flip-h: 56px; --sf-flip-w: 54px; --sf-flip-fs: 28px; gap: 8px; }
}
@media (max-width: 360px) {
  .sf-flip--md { --sf-flip-h: 50px; --sf-flip-w: 48px; --sf-flip-fs: 25px; gap: 6px; }
}
`
