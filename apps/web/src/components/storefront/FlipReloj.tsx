// El reloj de la oferta relámpago como fichas de calendario que giran
// (split-flap): cada unidad —días, horas, minutos, segundos— es una tarjeta
// partida al medio; cuando el valor cambia, la mitad de arriba cae mostrando
// el número viejo y la de abajo sube con el nuevo. Ale (08/09): "hojitas tipo
// calendario que se van dando vueltas".
//
// Sin estado ni efectos: como es una cuenta REGRESIVA, el valor anterior de
// cada unidad es siempre el siguiente en el ciclo (07 venía de 08; 00 seg de
// 59). Las hojas que giran llevan `key={valor}`, así se vuelven a montar —y la
// animación arranca de cero— solo cuando esa unidad cambia.
//
// Capas de cada ficha, de abajo hacia arriba:
//   1. base arriba (nuevo) y base abajo (nuevo): lo único visible en reposo.
//   2. tapa abajo (viejo): cubre la base de abajo hasta que la hoja que sube
//      aterriza, y ahí se esconde. Sin esto el número nuevo se veía abajo
//      antes de tiempo ("se nota el número siguiente", Ale).
//   3. hoja que cae (viejo, arriba) y hoja que sube (nuevo, abajo): giran y al
//      terminar se esconden (visibility), para que en reposo no queden dos
//      copias del mismo número una encima de otra —el 3D rasteriza aparte y
//      dejaba un "fantasma" borroso alrededor de los dígitos.
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
      <Ficha valor={t.horas} anterior={(t.horas + 1) % 24} label="horas" />
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
        <div className="sf-flip-mitad sf-flip-arriba"><span>{nuevo}</span></div>
        <div className="sf-flip-mitad sf-flip-abajo"><span>{nuevo}</span></div>
        {/* Todo lo que sigue se vuelve a montar con cada valor (key). */}
        <div key={`t-${nuevo}`} className="sf-flip-mitad sf-flip-abajo sf-flip-tapa"><span>{viejo}</span></div>
        <div key={`c-${nuevo}`} className="sf-flip-mitad sf-flip-arriba sf-flip-cae"><span>{viejo}</span></div>
        <div key={`s-${nuevo}`} className="sf-flip-mitad sf-flip-abajo sf-flip-sube"><span>{nuevo}</span></div>
        <div className="sf-flip-bisagra" />
      </div>
      <span className="sf-flip-label">{label}</span>
    </div>
  )
}

const ESTILOS = `
.sf-flip { display: flex; align-items: flex-start; gap: 12px; }
.sf-flip--md { --sf-flip-h: 68px; --sf-flip-w: 66px; --sf-flip-fs: 36px; --sf-flip-r: 11px; }
.sf-flip--sm { --sf-flip-h: 40px; --sf-flip-w: 38px; --sf-flip-fs: 20px; --sf-flip-r: 7px; gap: 6px; }

/* Tiempos de la vuelta: la hoja de arriba cae y, sin pausa, la de abajo sube.
   Total 400ms: se ve el giro, pero la ficha de los segundos pasa más de la
   mitad de cada segundo quieta y nítida (con 640ms se veía siempre en
   movimiento, oscura y borrosa). */
.sf-flip { --sf-flip-t: 200ms; }

.sf-flip-u { display: flex; flex-direction: column; align-items: center; gap: 7px; }
.sf-flip--sm .sf-flip-u { gap: 3px; }

/* La tarjeta: negro con transparencia encima del degradé de la cartelera, así
   toma el tono de la marca (una ficha bordó sobre rojo, azul oscuro sobre
   azul). El texto hereda color-on-primary. */
.sf-flip-card {
  position: relative; width: var(--sf-flip-w); height: var(--sf-flip-h);
  border-radius: var(--sf-flip-r);
  font-family: "Geist Mono", "Fira Code", monospace;
  font-size: var(--sf-flip-fs); font-weight: 700; line-height: var(--sf-flip-h);
  font-variant-numeric: tabular-nums; letter-spacing: -0.03em;
  perspective: 320px;
  /* overflow hidden: la hoja que gira, vista de canto con perspectiva, se
     proyectaba como una línea que sobresalía de la tarjeta hacia los
     costados. Recortar al borde redondeado la deja adentro. */
  overflow: hidden;
  box-shadow: 0 10px 22px -8px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.10) inset;
}

.sf-flip-mitad {
  position: absolute; left: 0; width: 100%; height: 50%; overflow: hidden;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  /* Todas las mitades se rasterizan como capa (igual que las que giran), así
     los dígitos quedan idénticos en reposo y en movimiento. */
  transform: translateZ(0);
}
.sf-flip-mitad span {
  position: absolute; left: 0; width: 100%; height: var(--sf-flip-h);
  text-align: center; line-height: var(--sf-flip-h);
  text-shadow: 0 1px 0 rgba(0,0,0,0.35);
}
.sf-flip-arriba {
  top: 0; border-radius: var(--sf-flip-r) var(--sf-flip-r) 0 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.22), rgba(0,0,0,0.30));
  transform-origin: 50% 100%;
}
.sf-flip-arriba span { top: 0; }
.sf-flip-abajo {
  bottom: 0; border-radius: 0 0 var(--sf-flip-r) var(--sf-flip-r);
  background: linear-gradient(180deg, rgba(0,0,0,0.40), rgba(0,0,0,0.34));
  transform-origin: 50% 0%;
}
/* El número entero mide la tarjeta completa; en la mitad de abajo se lo sube
   media tarjeta para que asome su mitad inferior. */
.sf-flip-abajo span { top: -100%; }

/* La bisagra: una ranura oscura fina con un brillo debajo, como la del
   mecanismo real. Va encima de todo. */
.sf-flip-bisagra {
  position: absolute; left: 0; right: 0; top: 50%; height: 2px; margin-top: -1px; z-index: 8;
  background: rgba(0,0,0,0.55);
  box-shadow: 0 1px 0 rgba(255,255,255,0.08);
}

/* Capas que giran / tapan. Se esconden solas al terminar. */
.sf-flip-tapa { z-index: 3; animation: sf-flip-esconder 1ms calc(var(--sf-flip-t) * 2) linear forwards; }
.sf-flip-cae  { z-index: 5; animation: sf-flip-caer var(--sf-flip-t) ease-in forwards; }
.sf-flip-sube { z-index: 5; transform: rotateX(90deg); animation: sf-flip-subir var(--sf-flip-t) var(--sf-flip-t) ease-out forwards; }

/* Sombra que acompaña el giro: la hoja que cae se oscurece al plegarse y la
   que sube empieza en penumbra y se aclara al aterrizar. */
.sf-flip-cae::after, .sf-flip-sube::after {
  content: ""; position: absolute; inset: 0; background: rgba(0,0,0,0.38); pointer-events: none;
}
.sf-flip-cae::after  { opacity: 0; animation: sf-flip-oscurecer var(--sf-flip-t) ease-in forwards; }
.sf-flip-sube::after { opacity: 1; animation: sf-flip-aclarar var(--sf-flip-t) var(--sf-flip-t) ease-out forwards; }

@keyframes sf-flip-caer {
  0%   { transform: rotateX(0deg); visibility: visible; }
  99%  { transform: rotateX(-90deg); visibility: visible; }
  100% { transform: rotateX(-90deg); visibility: hidden; }
}
@keyframes sf-flip-subir {
  0%   { transform: rotateX(90deg); visibility: visible; }
  99%  { transform: rotateX(0deg); visibility: visible; }
  100% { transform: rotateX(0deg); visibility: hidden; }
}
@keyframes sf-flip-esconder { to { visibility: hidden; } }
@keyframes sf-flip-oscurecer { from { opacity: 0; } to { opacity: 1; } }
@keyframes sf-flip-aclarar { from { opacity: 1; } to { opacity: 0; } }

.sf-flip-label {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; opacity: 0.85;
}
.sf-flip--sm .sf-flip-label { font-size: 9px; }

/* Sin movimiento: solo las bases, que ya muestran el número nuevo. */
@media (prefers-reduced-motion: reduce) {
  .sf-flip-tapa, .sf-flip-cae, .sf-flip-sube { display: none; }
}

/* Celular: las fichas se achican para que las cuatro (con días) entren en
   390px con aire. */
@media (max-width: 720px) {
  .sf-flip--md { --sf-flip-h: 58px; --sf-flip-w: 56px; --sf-flip-fs: 30px; gap: 9px; }
}
@media (max-width: 360px) {
  .sf-flip--md { --sf-flip-h: 52px; --sf-flip-w: 50px; --sf-flip-fs: 26px; gap: 7px; }
}
`
