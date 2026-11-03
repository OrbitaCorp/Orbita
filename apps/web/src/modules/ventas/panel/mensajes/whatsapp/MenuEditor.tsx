import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { MenuEstilo, OpcionDeMenu } from '@/lib/api'
import { LIMITES, moverOpcion, nuevaOpcionPropia } from './menuBot'

// El editor del menú de Orbi en WhatsApp: el saludo, las opciones (se prenden, apagan, renombran y reordenan; el dueño puede
// sumar las suyas con un texto fijo de respuesta) y una vista previa de cómo le llega al cliente. Usa las variables --wa-*.

interface Props {
  estilo: MenuEstilo
  bienvenida: string
  bienvenidaPorDefecto: string
  opciones: OpcionDeMenu[]
  deshabilitado?: boolean
  onBienvenida: (t: string) => void
  onOpciones: (o: OpcionDeMenu[]) => void
}

const NOMBRES: Record<string, string> = {
  catalogo: 'Catálogo', pedidos: 'Pedidos del cliente', promos: 'Promos y cupones', envios: 'Envíos y pagos', horarios: 'Horarios y contacto', persona: 'Pasa el chat a una persona',
}

export function MenuEditor({ estilo, bienvenida, bienvenidaPorDefecto, opciones, deshabilitado, onBienvenida, onOpciones }: Props) {
  const tope = estilo === 'BOTONES' ? LIMITES.tituloBoton : LIMITES.tituloLista
  const cambiar = (i: number, cambios: Partial<OpcionDeMenu>) => onOpciones(opciones.map((o, k) => (k === i ? { ...o, ...cambios } : o)))
  const activas = opciones.filter((o) => o.activa)
  const saludo = bienvenida.trim() || bienvenidaPorDefecto

  return (
    <div className="mnu-raiz">
      <label className="orb-titulo" htmlFor="orbi-bienvenida">Saludo</label>
      <p className="orb-ayuda">Lo primero que ve el cliente, arriba del menú.</p>
      <textarea
        id="orbi-bienvenida" className="orb-campo" rows={2} maxLength={LIMITES.bienvenida} value={bienvenida} disabled={deshabilitado}
        onChange={(e) => onBienvenida(e.target.value)} placeholder={bienvenidaPorDefecto}
      />

      <p className="orb-titulo mnu-sub">Opciones</p>
      <p className="orb-ayuda">
        {estilo === 'BOTONES' ? `Con botones entran hasta ${LIMITES.opcionesBotones} opciones activas.` : `En lista entran hasta ${LIMITES.opcionesLista} opciones.`} Prendé, apagá y ordená a tu gusto.
      </p>
      <ul className="mnu-lista">
        {opciones.map((o, i) => {
          const propia = o.id.startsWith('custom-')
          const largo = o.titulo.trim().length > tope
          return (
            <li key={o.id} className={`mnu-opcion${o.activa ? '' : ' mnu-apagada'}`}>
              <div className="mnu-fila">
                <span className="mnu-mover">
                  <button type="button" aria-label="Subir" disabled={deshabilitado || i === 0} onClick={() => onOpciones(moverOpcion(opciones, i, -1))}><ArrowUp size={14} /></button>
                  <button type="button" aria-label="Bajar" disabled={deshabilitado || i === opciones.length - 1} onClick={() => onOpciones(moverOpcion(opciones, i, 1))}><ArrowDown size={14} /></button>
                </span>
                <input
                  className={`orb-campo mnu-titulo${largo ? ' mnu-excede' : ''}`} value={o.titulo} disabled={deshabilitado} aria-label={`Título de la opción ${i + 1}`}
                  onChange={(e) => cambiar(i, { titulo: e.target.value })} placeholder="Título"
                />
                <span className={`mnu-cuenta${largo ? ' mnu-excede-txt' : ''}`}>{o.titulo.trim().length}/{tope}</span>
                <button
                  type="button" role="switch" aria-checked={o.activa} aria-label={`Opción ${o.titulo || i + 1} activa`} disabled={deshabilitado}
                  className={`orb-switch orb-switch-chico${o.activa ? ' orb-switch-on' : ''}`} onClick={() => cambiar(i, { activa: !o.activa })}
                ><i /></button>
                {propia && (
                  <button type="button" className="mnu-borrar" aria-label={`Quitar la opción ${o.titulo || i + 1}`} disabled={deshabilitado} onClick={() => onOpciones(opciones.filter((_, k) => k !== i))}><Trash2 size={15} /></button>
                )}
              </div>
              {estilo === 'LISTA' && (
                <input
                  className="orb-campo mnu-desc" value={o.descripcion ?? ''} maxLength={LIMITES.descripcion} disabled={deshabilitado} aria-label={`Descripción de la opción ${i + 1}`}
                  onChange={(e) => cambiar(i, { descripcion: e.target.value })} placeholder="Descripción corta (opcional)"
                />
              )}
              {propia ? (
                <textarea
                  className="orb-campo mnu-resp" rows={2} maxLength={LIMITES.respuesta} value={o.respuesta ?? ''} disabled={deshabilitado} aria-label={`Respuesta de la opción ${i + 1}`}
                  onChange={(e) => cambiar(i, { respuesta: e.target.value })} placeholder="Lo que contesta Orbi cuando el cliente elige esta opción"
                />
              ) : (
                <p className="mnu-de-fabrica">{NOMBRES[o.id] ?? 'Opción de Orbi'} · Orbi responde con datos de tu tienda</p>
              )}
            </li>
          )
        })}
      </ul>
      <button type="button" className="mnu-agregar" disabled={deshabilitado || opciones.length >= LIMITES.opcionesLista} onClick={() => onOpciones([...opciones, nuevaOpcionPropia(opciones)])}>
        <Plus size={15} aria-hidden /> Agregar una opción propia
      </button>

      <p className="orb-titulo mnu-sub">Así lo ve el cliente</p>
      <div className="mnu-vista" aria-label="Vista previa del menú">
        <div className="mnu-burbuja">
          <p>{saludo}</p>
          {estilo === 'LISTA' ? <span className="mnu-boton-lista">☰ Ver opciones</span> : null}
        </div>
        {estilo === 'BOTONES' ? (
          <div className="mnu-botones">{activas.slice(0, LIMITES.opcionesBotones).map((o) => <span key={o.id}>{o.titulo.trim() || 'Sin título'}</span>)}</div>
        ) : (
          <ol className="mnu-filas">
            {activas.slice(0, LIMITES.opcionesLista).map((o) => (
              <li key={o.id}><strong>{o.titulo.trim() || 'Sin título'}</strong>{o.descripcion?.trim() ? <small>{o.descripcion.trim()}</small> : null}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

export const CSS_MENU = `
.mnu-raiz { display: flex; flex-direction: column; gap: 8px; }
.mnu-sub { margin-top: 8px; }
.mnu-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mnu-opcion { padding: 10px 12px; border: 1px solid var(--wa-borde); border-radius: 8px; display: flex; flex-direction: column; gap: 6px; }
.mnu-apagada { opacity: 0.6; }
.mnu-fila { display: flex; align-items: center; gap: 8px; }
.mnu-mover { display: inline-flex; flex-direction: column; gap: 2px; }
.mnu-mover button, .mnu-borrar { width: 26px; height: 22px; padding: 0; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--wa-icono); background: transparent; }
.mnu-mover button:hover:not(:disabled), .mnu-borrar:hover:not(:disabled) { background: var(--wa-hover); }
.mnu-mover button:disabled { opacity: 0.3; cursor: not-allowed; }
.mnu-borrar { width: 30px; height: 30px; color: var(--wa-error); }
.mnu-titulo { flex: 1; min-width: 0; padding: 6px 10px; }
.mnu-desc, .mnu-resp { padding: 6px 10px; font-size: 13px; }
.mnu-excede { border-color: var(--wa-error); }
.mnu-cuenta { flex-shrink: 0; font-size: 11.5px; font-variant-numeric: tabular-nums; color: var(--wa-texto-2); }
.mnu-excede-txt { color: var(--wa-error); font-weight: 600; }
.mnu-de-fabrica { margin: 0; font-size: 12px; color: var(--wa-texto-2); }
.orb-switch-chico { width: 36px; height: 22px; border-radius: 11px; }
.orb-switch-chico i { top: 3px; left: 3px; width: 16px; height: 16px; }
.orb-switch-chico.orb-switch-on i { transform: translateX(14px); }
.mnu-agregar { align-self: flex-start; height: 34px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border: 1px dashed var(--wa-borde); border-radius: 17px; cursor: pointer; font-size: 13.5px; color: var(--wa-texto); background: transparent; }
.mnu-agregar:hover:not(:disabled) { background: var(--wa-hover); }
.mnu-agregar:disabled { opacity: 0.5; cursor: not-allowed; }
.mnu-vista { padding: 14px; border-radius: 8px; background: var(--wa-chat); background-image: var(--wa-patron); background-size: 200px 200px; display: flex; flex-direction: column; gap: 6px; max-width: 340px; }
.mnu-burbuja { padding: 8px 10px; border-radius: 0 8px 8px 8px; background: var(--wa-entrante); box-shadow: var(--wa-sombra); font-size: 14px; line-height: 1.4; color: var(--wa-texto); }
.mnu-burbuja p { margin: 0; white-space: pre-wrap; }
.mnu-boton-lista { display: block; margin: 8px -10px -8px; padding: 8px 10px; border-top: 1px solid var(--wa-borde); text-align: center; font-size: 14px; font-weight: 500; color: #027eb5; }
.dark .mnu-boton-lista { color: #53bdeb; }
.mnu-botones { display: flex; flex-direction: column; gap: 4px; }
.mnu-botones span { padding: 9px; border-radius: 8px; text-align: center; font-size: 14px; font-weight: 500; color: #027eb5; background: var(--wa-entrante); box-shadow: var(--wa-sombra); }
.dark .mnu-botones span { color: #53bdeb; }
.mnu-filas { list-style: none; margin: 0; padding: 6px 10px; border-radius: 8px; background: var(--wa-entrante); box-shadow: var(--wa-sombra); display: flex; flex-direction: column; gap: 6px; }
.mnu-filas li { display: flex; flex-direction: column; font-size: 14px; color: var(--wa-texto); }
.mnu-filas small { font-size: 12px; color: var(--wa-texto-2); }
`
