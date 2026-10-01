// ─── Pet de Orbi: los dibujos ────────────────────────────────────────────────
// Cuerpos (s1–s9), caras (f*), accesorios (ac*), visor y órbita, pasados a JSX
// desde el diseño "Orbi Formas v2" con las mismas coordenadas (viewBox 0–100).
// Cada pieza recibe `a` (animado): sin él no se emite ningún <animate>, así el
// pet chico del menú o del avatar queda quieto y no suma trabajo al navegador.
// `u(id)` arma el url(#…) con el prefijo único de cada instancia.

import type { ReactNode } from 'react'
import type { PetAccesorio, PetCara, PetCuerpo } from './petModulos'

type U = (id: string) => string
interface P { a: boolean; u: U }

const OJO = '#9fc0ff'
const SAT = (u: U) => u('sat')
const trazo = { stroke: OJO, fill: 'none', strokeLinecap: 'round' as const }

export function PetDefs({ id }: { id: (n: string) => string }) {
  return (
    <defs>
      <linearGradient id={id('sat')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eef1fb" /><stop offset=".55" stopColor="#a3b0d6" /><stop offset="1" stopColor="#5f6c9a" /></linearGradient>
      <linearGradient id={id('dus')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b4c0ec" /><stop offset="1" stopColor="#5563aa" /></linearGradient>
      <radialGradient id={id('blm')}><stop offset="0" stopColor="#b3caf5" /><stop offset=".5" stopColor="#5f8ae0" /><stop offset="1" stopColor="#3a5cb8" /></radialGradient>
      <radialGradient id={id('glm')}><stop offset="0" stopColor="#5f8ae0" stopOpacity=".5" /><stop offset="1" stopColor="#5f8ae0" stopOpacity="0" /></radialGradient>
      <linearGradient id={id('vis')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c2550" /><stop offset="1" stopColor="#0c1130" /></linearGradient>
      {/* La sombra del diseño (drop-shadow 1px 3px 3px a 340px) llevada a unidades del viewBox. */}
      <filter id={id('sh')} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx=".35" dy="1" stdDeviation=".9" floodColor="#000" floodOpacity=".5" /></filter>
    </defs>
  )
}

// ── Animaciones reutilizadas ────────────────────────────────────────────────

function Parpadeo() {
  return <animate attributeName="opacity" values="1;1;.2;1" keyTimes="0;.93;.96;1" dur="3.8s" repeatCount="indefinite" />
}

/** Flotar suave de los accesorios. */
function Flota({ a, values = '0 2;0 -3;0 2', dur = '2.4s', children }: { a: boolean; values?: string; dur?: string; children: ReactNode }) {
  return (
    <g>
      {a && <animateTransform attributeName="transform" type="translate" values={values} dur={dur} repeatCount="indefinite" />}
      {children}
    </g>
  )
}

function Ojos({ a, y = 47 }: { a: boolean; y?: number }) {
  return (
    <g>
      <rect x="39" y={y} width="5" height="6" rx="1.4" fill={OJO} />
      <rect x="56" y={y} width="5" height="6" rx="1.4" fill={OJO} />
      {a && <Parpadeo />}
    </g>
  )
}

const CORAZON = 'M0 3C-6 -1 -4 -6 0 -3C4 -6 6 -1 0 3Z'

// ── Órbita y satélite ───────────────────────────────────────────────────────

const RECORRIDO = 'M94 50A44 15 0 0 1 6 50A44 15 0 0 1 94 50'

/** Tramo de atrás de la órbita: va antes que el cuerpo. */
export function OrbitaAtras({ a, u }: P) {
  return (
    <g transform="rotate(-22 50 50)">
      <path d="M6 50A44 15 0 0 1 94 50" fill="none" stroke="#b8c4e6" strokeWidth="1.2" opacity=".28" />
      {a && (
        <g>
          <circle r="8.1" fill={u('glm')} />
          <circle r="3.6" fill={u('blm')} />
          <animateMotion dur="6s" repeatCount="indefinite" path={RECORRIDO} />
          <animate attributeName="opacity" values="0;1" keyTimes="0;0.5" calcMode="discrete" dur="6s" repeatCount="indefinite" />
        </g>
      )}
    </g>
  )
}

/** Tramo de adelante: va después del cuerpo. Quieto, el satélite descansa abajo a la derecha. */
export function OrbitaAdelante({ a, u }: P) {
  return (
    <g transform="rotate(-22 50 50)">
      <path d="M6 50A44 15 0 0 0 94 50" fill="none" stroke="#c3cdea" strokeWidth="1.8" opacity=".75" />
      <g transform={a ? undefined : 'translate(74 62.6)'}>
        <circle r="9.1" fill={u('glm')} />
        <circle r="4.6" fill={u('blm')} />
        <circle cx="-1.3" cy="-1.4" r="1.2" fill="#e3ecff" opacity=".8" />
        {a && (
          <>
            <animateMotion dur="6s" repeatCount="indefinite" path={RECORRIDO} />
            <animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="6s" repeatCount="indefinite" />
          </>
        )}
      </g>
    </g>
  )
}

// ── Visor ───────────────────────────────────────────────────────────────────

export function Visor({ a, u }: P) {
  return (
    <>
      <rect x="34" y="41" width="32" height="19" rx="6" fill={u('vis')} stroke="#dfe6fa" strokeWidth="1.2" strokeOpacity=".6" />
      <rect x="35" y="42" width="30" height="1.6" fill={OJO} opacity=".4">
        {a && <animate attributeName="y" values="42;57;42" dur="3s" repeatCount="indefinite" />}
      </rect>
    </>
  )
}

// ── Cuerpos ─────────────────────────────────────────────────────────────────

export function Cuerpo({ id, a, u }: P & { id: PetCuerpo }) {
  const sat = SAT(u)
  switch (id) {
    case 's1': return (
      <>
        <circle cx="50" cy="50" r="30" fill={sat} />
        <path d="M26 40A26 26 0 0 1 44 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5" />
        <path d="M76 60A26 26 0 0 1 58 76" fill="none" stroke="#2b3563" strokeWidth="3" strokeLinecap="round" opacity=".25" />
      </>
    )
    case 's2': return (
      <>
        <path d="M38 36C37 18 63 18 62 36" fill="none" stroke="#a3b0d6" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 36C44 27 56 27 56 36" fill="none" stroke="#8f9ccc" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M32 36H68L76 77A5 5 0 0 1 71 82H29A5 5 0 0 1 24 77Z" fill={sat} />
        <path d="M32 36H68L69.4 44H30.6Z" fill="#8f9ccc" />
      </>
    )
    case 's3': return (
      <>
        <circle cx="42" cy="50" r="27" fill={sat} />
        <path d="M20 42A24 24 0 0 1 36 27" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5" />
        <circle cx="76" cy="63" r="14" fill={u('dus')} />
        <circle cx="72" cy="61" r="1.8" fill="#1f2858" />
        <circle cx="80" cy="61" r="1.8" fill="#1f2858" />
        <path d="M73 67Q76 69.5 79 67" fill="none" stroke="#1f2858" strokeWidth="1.6" strokeLinecap="round" />
      </>
    )
    case 's4': return (
      <>
        <rect x="25" y="32" width="50" height="47" rx="6" fill={sat} />
        <path d="M25 38A6 6 0 0 1 31 32H69A6 6 0 0 1 75 38V43H25Z" fill="#8f9ccc" />
        <rect x="43" y="32" width="14" height="11" fill="#dfe6fa" opacity=".8" />
      </>
    )
    case 's5': return (
      <>
        <path d="M36 26H64A14 14 0 0 1 78 40V54A14 14 0 0 1 64 68H46L32 82V68.5A14 14 0 0 1 22 54V40A14 14 0 0 1 36 26Z" fill={sat} />
        <path d="M27 38A10 10 0 0 1 36 30" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5" />
      </>
    )
    case 's6': return (
      <>
        <path d="M37 37C30 22 20 24 15 16" fill="none" stroke="#a3b0d6" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M31 28H62L77 43V73A5 5 0 0 1 72 78H31A5 5 0 0 1 26 73V33A5 5 0 0 1 31 28Z" fill={sat} />
        <circle cx="37" cy="37" r="3.4" fill="#0f1431" />
        <circle cx="37" cy="37" r="3.4" fill="none" stroke="#dfe6fa" strokeWidth="1" />
      </>
    )
    case 's7': return (
      <g>
        {a && <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="24s" repeatCount="indefinite" />}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(g => (
          <rect key={g} x="43" y="17" width="14" height="14" rx="3" fill={sat} transform={g ? `rotate(${g} 50 50)` : undefined} />
        ))}
        <circle cx="50" cy="50" r="26" fill={sat} />
      </g>
    )
    case 's8': return (
      <>
        <path d="M50 8C56 36 64 44 92 50C64 56 56 64 50 92C44 64 36 56 8 50C36 44 44 36 50 8Z" fill={sat} stroke={sat} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="50" cy="50" r="19" fill={sat} />
        <g fill="#fff">
          <path d="M84 14Q84.4 17.6 88 18Q84.4 18.4 84 22Q83.6 18.4 80 18Q83.6 17.6 84 14Z" opacity={a ? undefined : .6}>
            {a && <animate attributeName="opacity" values=".15;1;.15" dur="3s" repeatCount="indefinite" />}
          </path>
          <path d="M14 80Q14.3 82.7 17 83Q14.3 83.3 14 86Q13.7 83.3 11 83Q13.7 82.7 14 80Z" opacity={a ? undefined : .6}>
            {a && <animate attributeName="opacity" values="1;.15;1" dur="3.6s" repeatCount="indefinite" />}
          </path>
        </g>
      </>
    )
    case 's9': return (
      <>
        <path d="M50 40C41 35 31 35 21 38V77C31 74 41 74 50 79Z" fill="#8f9ccc" />
        <path d="M50 40C59 35 69 35 79 38V77C69 74 59 74 50 79Z" fill="#8f9ccc" />
        <path d="M50 36C41 31 31 31 21 34V73C31 70 41 70 50 75Z" fill={sat} />
        <path d="M50 36C59 31 69 31 79 34V73C69 70 59 70 50 75Z" fill={sat} />
        <path d="M50 36V75" stroke="#8f9ccc" strokeWidth="1.4" />
      </>
    )
  }
}

// ── Caras ───────────────────────────────────────────────────────────────────

export function Cara({ id, a }: { id: PetCara; a: boolean }) {
  switch (id) {
    // Ojos felices (Pedidos, y la cara de las cosquillas).
    case 'f2': return (
      <>
        <g>
          <path d="M38.5 52Q41.5 46.5 44.5 52M55.5 52Q58.5 46.5 61.5 52" {...trazo} strokeWidth="2.2" />
          {a && <Parpadeo />}
        </g>
        <path d="M45.5 55.5Q50 60 54.5 55.5" {...trazo} strokeWidth="1.6" />
      </>
    )
    // Corazones (Clientes).
    case 'f3': return (
      <>
        {[41.5, 58.5].map(x => (
          <g key={x} transform={`translate(${x} 50.5)`}>
            <g>
              {a && <animateTransform attributeName="transform" type="scale" values="1;1.25;1" dur=".9s" repeatCount="indefinite" />}
              <path d={CORAZON} fill="#f0a0bb" />
            </g>
          </g>
        ))}
        <path d="M47 56Q50 58.5 53 56" {...trazo} strokeWidth="1.5" />
      </>
    )
    // Pensativo (Configuración, y cuando algo salió mal).
    case 'f4': return (
      <>
        <g transform={a ? undefined : 'translate(-2 -2)'}>
          {a && <animateTransform attributeName="transform" type="translate" values="-2 -2;-3 -2;-2 -2" dur="2.4s" repeatCount="indefinite" />}
          <Ojos a={a} />
          <path d="M55 44L62 42.5" {...trazo} strokeWidth="1.4" />
        </g>
        <path d="M46 57q2 -1.6 4 0t4 0" {...trazo} strokeWidth="1.4" />
      </>
    )
    // Escribiendo (Mensajes, y mientras Orbi responde).
    case 'f5': return (
      <>
        <Ojos a={a} y={48.5} />
        {[46, 50, 54].map((cx, i) => (
          <circle key={cx} cx={cx} cy="57" r="1.3" fill={OJO}>
            {a && <animate attributeName="cy" values="57;54.8;57" begin={`${i * .15}s`} dur=".9s" repeatCount="indefinite" />}
          </circle>
        ))}
      </>
    )
    // Asombro (Descuentos).
    case 'f6': return (
      <>
        <rect x="38.5" y="44.5" width="6" height="8" rx="2" fill={OJO} />
        <rect x="55.5" y="44.5" width="6" height="8" rx="2" fill={OJO} />
        <circle cx="40.5" cy="46.7" r="1" fill="#fff" />
        <circle cx="57.5" cy="46.7" r="1" fill="#fff" />
        <ellipse cx="50" cy="57" rx="2.2" ry="2.2" {...trazo} strokeWidth="1.6" />
      </>
    )
    // Guiño (Inicio, Avanzado).
    case 'f8': return (
      <>
        <g>
          <rect x="39" y="47" width="5" height="6" rx="1.4" fill={OJO} />
          <path d="M55.5 51.5Q58.5 47.5 61.5 51.5" {...trazo} strokeWidth="2" />
          {a && <Parpadeo />}
        </g>
        <path d="M45.5 55.5Q50 60 55 55" {...trazo} strokeWidth="1.6" />
      </>
    )
    // Mira a los lados (Manual).
    case 'f9': return (
      <>
        <g transform={a ? undefined : 'translate(0 1)'}>
          {a && <animateTransform attributeName="transform" type="translate" values="-2 1;2 1;-2 1" dur="2.4s" repeatCount="indefinite" />}
          <Ojos a={a} />
        </g>
        <path d="M47 56Q50 57.5 53 56" {...trazo} strokeWidth="1.5" />
      </>
    )
    // Repasa de un lado a otro (Productos).
    case 'f10': return (
      <>
        <g>
          {a && <animateTransform attributeName="transform" type="translate" values="-2 0;-2 0;2 0;2 0;-2 0" keyTimes="0;.3;.35;.8;1" calcMode="discrete" dur="3.2s" repeatCount="indefinite" />}
          <Ojos a={a} />
        </g>
        <path d="M38 44.5H45M55 44.5H62" {...trazo} strokeWidth="1.3" opacity=".8" />
        <path d="M46.5 56Q50 58 53.5 56" {...trazo} strokeWidth="1.6" />
      </>
    )
  }
}

// ── Accesorios (flotan arriba a la derecha, centro ~80,22) ──────────────────

function Check({ y, begin, a }: { y: number; begin: string; a: boolean }) {
  return (
    <>
      <g opacity={a ? undefined : 1}>
        <path d={`M74 ${y}l1.6 1.6 3-3.2`} fill="none" stroke="#5f8ae0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {a && <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" begin={begin} dur="3s" repeatCount="indefinite" />}
      </g>
      <path d={`M81 ${y}H86`} stroke="#8f9ccc" strokeWidth="1.4" strokeLinecap="round" />
    </>
  )
}

export function Accesorio({ id, a }: { id: PetAccesorio; a: boolean }) {
  switch (id) {
    // Destello (Inicio).
    case 'ac1': return (
      <Flota a={a}><path d="M80 15Q80.9 21.1 87 22Q80.9 22.9 80 29Q79.1 22.9 73 22Q79.1 21.1 80 15Z" fill="#b3caf5" /></Flota>
    )
    // Check (Pedidos).
    case 'ac2': return (
      <Flota a={a}>
        <circle cx="80" cy="22" r="8" fill="#5f8ae0" />
        <path d="M76 22.5L79 25.5L84.5 19" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Flota>
    )
    // Corazones que suben (Clientes).
    case 'ac3': return (
      <>
        {([[76, 26, 0], [86, 24, .7], [81, 20, 1.3]] as const).map(([x, y, b]) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <g opacity={a ? undefined : .85}>
              {a && <animateTransform attributeName="transform" type="translate" values="0 0;0 -9" begin={`${b}s`} dur="2s" repeatCount="indefinite" />}
              {a && <animate attributeName="opacity" values="0;1;0" begin={`${b}s`} dur="2s" repeatCount="indefinite" />}
              <path d={CORAZON} fill="#f0a0bb" />
            </g>
          </g>
        ))}
      </>
    )
    // Globo "escribiendo" (Mensajes).
    case 'ac5': return (
      <>
        <rect x="68" y="12" width="24" height="16" rx="8" fill="#5f8ae0" />
        {[74, 80, 86].map((cx, i) => (
          <circle key={cx} cx={cx} cy="21" r="1.6" fill="#fff">
            {a && <animate attributeName="cy" values="21;18.5;21" begin={`${i * .15}s`} dur=".9s" repeatCount="indefinite" />}
          </circle>
        ))}
      </>
    )
    // Moneda con % (Descuentos).
    case 'ac6': return (
      <g>
        {a && <animateTransform attributeName="transform" type="rotate" values="-10 80 22;10 80 22;-10 80 22" dur="1.2s" repeatCount="indefinite" />}
        <circle cx="80" cy="22" r="9" fill="#5f8ae0" />
        <text x="80" y="26" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="700" fontSize="12" fill="#fff">%</text>
      </g>
    )
    // Destello que gira (Avanzado).
    case 'ac8': return (
      <g>
        {a && <animateTransform attributeName="transform" type="rotate" from="0 82 20" to="360 82 20" dur="6s" repeatCount="indefinite" />}
        <path d="M82 11Q83 19 91 20Q83 21 82 29Q81 21 73 20Q81 19 82 11Z" fill="#fff" opacity=".9" />
      </g>
    )
    // Lamparita (Manual).
    case 'ac9': return (
      <Flota a={a}>
        <circle cx="80" cy="20" r="6" fill="#f2d58a" />
        <circle cx="80" cy="20" r="10" fill="#f2d58a" opacity=".2" />
        <rect x="77.5" y="25.5" width="5" height="3.2" rx="1" fill="#a3b0d6" />
      </Flota>
    )
    // Checklist (Productos).
    case 'ac10': return (
      <Flota a={a} values="0 2;0 -2;0 2" dur="2.8s">
        <rect x="70" y="11" width="20" height="24" rx="3" fill="#dfe6fa" />
        <rect x="76" y="8.5" width="8" height="5" rx="1.5" fill="#8f9ccc" />
        <Check y={19} begin="0s" a={a} />
        <Check y={25} begin="0.6s" a={a} />
        <Check y={31} begin="1.2s" a={a} />
      </Flota>
    )
    // Nube de pensamiento (Configuración).
    case 'ac11': return (
      <Flota a={a} values="0 2;0 -2;0 2" dur="2.6s">
        <circle cx="71" cy="33" r="1.5" fill="#dfe6fa" />
        <circle cx="74.5" cy="28.5" r="2.4" fill="#dfe6fa" />
        <ellipse cx="84" cy="17" rx="11" ry="8" fill="#dfe6fa" />
        <g fill="#5f8ae0">
          {[78, 84, 90].map((cx, i) => (
            <circle key={cx} cx={cx} cy="17" r="1.5" opacity={a ? undefined : .7}>
              {a && <animate attributeName="opacity" values=".3;1;.3" dur="1.2s" begin={`${i * .25}s`} repeatCount="indefinite" />}
            </circle>
          ))}
        </g>
      </Flota>
    )
  }
}
