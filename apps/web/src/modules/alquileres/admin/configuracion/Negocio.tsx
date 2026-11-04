// Datos del negocio: nombre, descripción, contacto y dirección. Aparecen en el
// sitio, en cada confirmación y en el pie de cada reserva.
import { useState } from 'react'
import { Area, BarraGuardar, Campo, Nota, Seccion } from '@/design-system/reservas/piezas'
import { TIPOS, type NegocioAlquiler } from '../../datos'
import { PaginaForm, igual, type Form } from './comun'

const de = (n: NegocioAlquiler) => ({ nombre: n.nombre, descripcion: n.descripcion, telefono: n.telefono, direccion: n.direccion, ciudad: n.ciudad })

export default function Negocio({ negocio, onGuardar }: Form) {
  const [v, setV] = useState(de(negocio))
  const cambiado = !igual(v, de(negocio))
  return (
    <PaginaForm rotulo={TIPOS[negocio.tipo].label} titulo="Datos del negocio" bajada="Aparecen en tu sitio, en cada confirmación y en el pie de cada reserva.">
      <div className="rv-pila">
        <Seccion titulo="Nombre y descripción" bajada="Lo primero que se lee en la portada de tu sitio.">
          <div className="rv-pila">
            <Campo label="Nombre" value={v.nombre} onChange={x => setV({ ...v, nombre: x })} maxLength={60} />
            <Area label="Descripción corta" value={v.descripcion} onChange={x => setV({ ...v, descripcion: x })} maxLength={240} ayuda={`${v.descripcion.length} de 240 caracteres.`} />
          </div>
        </Seccion>
        <Seccion titulo="Contacto y ubicación" bajada="El teléfono es al que te escriben; la dirección va en el mapa del sitio.">
          <div className="rv-pila">
            <div className="rv-dos">
              <Campo label="Teléfono" value={v.telefono} onChange={x => setV({ ...v, telefono: x })} inputMode="tel" />
              <Campo label="Ciudad" value={v.ciudad} onChange={x => setV({ ...v, ciudad: x })} />
            </div>
            <Campo label="Dirección" value={v.direccion} onChange={x => setV({ ...v, direccion: x })} />
          </div>
        </Seccion>
        <Nota><span>Tu sitio público es <b>orbita.site/{negocio.slug}</b>. Se abre desde “Tu sitio”, abajo del menú, y muestra estos datos al instante.</span></Nota>
      </div>
      <BarraGuardar cambiado={cambiado} onDescartar={() => setV(de(negocio))} onGuardar={() => onGuardar({ ...v, nombre: v.nombre.trim() || negocio.nombre })} />
    </PaginaForm>
  )
}
