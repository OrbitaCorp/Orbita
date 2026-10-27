// Datos del negocio: lo que aparece en el sitio y en cada confirmación, y
// quién administra (la cuenta con la que se mira el panel).
import { Area, Campo, Encabezado, Seccion } from '@/design-system/reservas/piezas'
import { BarraGuardar, useBorrador, type PropsConfig } from '../piezas'

export default function Negocio({ negocio, onGuardar }: PropsConfig) {
  const b = useBorrador({ nombre: negocio.nombre, descripcion: negocio.descripcion, telefono: negocio.telefono, direccion: negocio.direccion, ciudad: negocio.ciudad, dueno: negocio.dueno.nombre })
  const v = b.v
  const guardar = () => onGuardar({
    nombre: v.nombre.trim() || negocio.nombre, descripcion: v.descripcion.trim(), telefono: v.telefono.trim(), direccion: v.direccion.trim(), ciudad: v.ciudad.trim(),
    dueno: { ...negocio.dueno, nombre: v.dueno.trim() || negocio.dueno.nombre },
  }, 'Datos guardados')
  return (
    <div className="rv-pagina rv-pagina--form">
      <Encabezado rotulo="Configuración" titulo="Datos del negocio" bajada="Aparecen en tu sitio y en cada confirmación. Lo que cambiás acá se ve al instante." />
      <div className="rv-pila">
        <Seccion titulo="El negocio">
          <div className="rv-pila">
            <Campo label="Nombre" value={v.nombre} onChange={x => b.set('nombre', x)} maxLength={60} />
            <Area label="Descripción corta" value={v.descripcion} onChange={x => b.set('descripcion', x)} maxLength={240} ayuda="Una o dos líneas, debajo del nombre en tu sitio." />
          </div>
        </Seccion>
        <Seccion titulo="Contacto y dirección" bajada="Van al pie del sitio, en el mapa y en cada confirmación.">
          <div className="rv-pila">
            <div className="rv-dos">
              <Campo label="Teléfono" value={v.telefono} onChange={x => b.set('telefono', x)} inputMode="tel" />
              <Campo label="Ciudad" value={v.ciudad} onChange={x => b.set('ciudad', x)} />
            </div>
            <Campo label="Dirección" value={v.direccion} onChange={x => b.set('direccion', x)} />
          </div>
        </Seccion>
        <Seccion titulo="Quién administra" bajada="Tu nombre, como se ve en el panel y en Equipo.">
          <Campo label="Tu nombre" value={v.dueno} onChange={x => b.set('dueno', x)} maxLength={40} />
        </Seccion>
      </div>
      <BarraGuardar cambiado={b.cambiado} onGuardar={guardar} onDescartar={b.descartar} />
    </div>
  )
}
