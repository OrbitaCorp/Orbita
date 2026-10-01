// ─── Pet de Orbi: una forma por módulo ───────────────────────────────────────
// Tabla del diseño "Orbi Formas v2": cada módulo del menú lateral tiene su
// cuerpo, su cara, dónde se apoya el visor sobre ese cuerpo, un accesorio que
// flota arriba a la derecha y un gesto que hace al llegar. Inicio es la forma
// base: la que se usa cuando no se sabe en qué módulo se está.
//
// Las frases son neutrales a propósito. Las del diseño afirmaban cosas ("tenés
// pedidos para despachar") que serían mentira con el panel vacío; acá solo se
// ofrece ayuda, sin prometer datos que el pet no mira.

export type PetCuerpo = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9'
export type PetCara = 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f8' | 'f9' | 'f10'
export type PetAccesorio = 'ac1' | 'ac2' | 'ac3' | 'ac5' | 'ac6' | 'ac8' | 'ac9' | 'ac10' | 'ac11'
export type PetGesto = 'hop' | 'nod' | 'wiggle' | 'sort' | 'pulse' | 'spin' | 'tilt' | 'flip' | 'bow'

export interface PetModulo {
  id: string
  nombre: string
  cuerpo: PetCuerpo
  cara: PetCara
  /** Corrimiento del visor (unidades del viewBox 0–100) para que caiga sobre el cuerpo. */
  visor: [number, number]
  accesorio: PetAccesorio
  gesto: PetGesto
  frase: string
}

export const PET_MODULOS: PetModulo[] = [
  { id: 'dashboard', nombre: 'Inicio', cuerpo: 's1', cara: 'f8', visor: [0, 0], accesorio: 'ac1', gesto: 'hop', frase: 'Acá estoy. Preguntame lo que quieras de tu negocio.' },
  { id: 'pedidos', nombre: 'Pedidos', cuerpo: 's2', cara: 'f2', visor: [0, 7], accesorio: 'ac2', gesto: 'nod', frase: '¿Revisamos tus pedidos juntos?' },
  { id: 'clientes', nombre: 'Clientes', cuerpo: 's3', cara: 'f3', visor: [-8, 0], accesorio: 'ac3', gesto: 'wiggle', frase: 'Te ayudo a conocer mejor a tus clientes.' },
  { id: 'productos', nombre: 'Productos', cuerpo: 's4', cara: 'f10', visor: [0, 8], accesorio: 'ac10', gesto: 'sort', frase: 'Todo en su lugar: ordenemos tu catálogo y tu stock.' },
  { id: 'mensajes', nombre: 'Mensajes', cuerpo: 's5', cara: 'f5', visor: [0, -2], accesorio: 'ac5', gesto: 'pulse', frase: 'Te ayudo a responderle a tus clientes.' },
  { id: 'descuentos', nombre: 'Descuentos', cuerpo: 's6', cara: 'f6', visor: [0, 8], accesorio: 'ac6', gesto: 'spin', frase: '¡Armemos un cupón con tope y vencimiento!' },
  { id: 'config', nombre: 'Configuración', cuerpo: 's7', cara: 'f4', visor: [0, 0], accesorio: 'ac11', gesto: 'tilt', frase: 'Mmm, dejame pensar… ¿ajustamos tu tienda, tu dominio y tus cobros?' },
  { id: 'avanzado', nombre: 'Avanzado', cuerpo: 's8', cara: 'f8', visor: [0, 0], accesorio: 'ac8', gesto: 'flip', frase: 'Probemos algo nuevo para vender más.' },
  { id: 'manual', nombre: 'Manual', cuerpo: 's9', cara: 'f9', visor: [0, 3], accesorio: 'ac9', gesto: 'bow', frase: 'Si te trabás en algo, te lo explico paso a paso.' },
]

export const PET_BASE = PET_MODULOS[0]

export function petModulo(id: string | undefined): PetModulo {
  return PET_MODULOS.find(m => m.id === id) ?? PET_BASE
}

/** Lo que dice cuando le hacen cosquillas. */
export const PET_COSQUILLAS = '¡Jaja! Me hacés cosquillas.'

// Gestos (Web Animations API) — los keyframes del diseño, tal cual.
export const PET_GESTOS: Record<PetGesto | 'shake', Keyframe[]> = {
  hop: [{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(2px) scale(1.08,.92)', offset: .2 }, { transform: 'translateY(-13px) scale(.94,1.06)', offset: .5 }, { transform: 'translateY(0) scale(1.07,.93)', offset: .78 }, { transform: 'translateY(0) scale(1,1)' }],
  nod: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(0deg)' }],
  wiggle: [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-7px) rotate(-8deg)' }, { transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-7px) rotate(8deg)' }, { transform: 'translateY(0) rotate(0)' }],
  sort: [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px) rotate(-3deg)', offset: .25 }, { transform: 'translateX(6px) rotate(3deg)', offset: .6 }, { transform: 'translateX(0)' }],
  tilt: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-12deg) translateX(-2px)', offset: .35 }, { transform: 'rotate(-12deg) translateX(-2px)', offset: .75 }, { transform: 'rotate(0deg)' }],
  pulse: [{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: .25 }, { transform: 'scale(.97)', offset: .5 }, { transform: 'scale(1.05)', offset: .75 }, { transform: 'scale(1)' }],
  spin: [{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(200deg) scale(1.12)', offset: .5 }, { transform: 'rotate(360deg) scale(1)' }],
  shake: [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px) rotate(-3deg)' }, { transform: 'translateX(4px) rotate(3deg)' }, { transform: 'translateX(-3px) rotate(-2deg)' }, { transform: 'translateX(3px) rotate(2deg)' }, { transform: 'translateX(0)' }],
  flip: [{ transform: 'scale(1,1)' }, { transform: 'scale(0,1.1)', offset: .5 }, { transform: 'scale(1,1)' }],
  bow: [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(4px) rotate(9deg)', offset: .4 }, { transform: 'translateY(4px) rotate(9deg)', offset: .65 }, { transform: 'translateY(0) rotate(0)' }],
}

/** Gestos al azar para las cosquillas. */
export const PET_GESTOS_COSQUILLAS: PetGesto[] = ['hop', 'wiggle', 'spin']
