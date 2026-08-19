// Muestra la foto real de una persona si tiene una cargada (Customer.avatarUrl
// / Member — ver meUploadAvatar), o si no, su inicial dentro de un círculo
// coloreado — antes SIEMPRE mostraba la inicial, incluso con una foto real ya
// subida: este componente es compartido por todo el panel, así que ese hueco
// se repetía en cada lugar que lo usa.

// El color se genera automáticamente a partir del nombre usando un hue (tono) derivado del código ASCII de cada letra. Esto garantiza que el mismo nombre
// siempre tenga el mismo color, sin necesidad de guardarlo en ningún lado.
// Se usa en: actividad reciente del Dashboard, lista de pedidos, detalle de pedido, lista de clientes, mensajes. Cualquier dev puedeimportarlo desde el design system sin tener que recrearlo.

interface AvatarProps {
    name:    string            // nombre completo o parcial — usa la primera letra
    size?:   number            // tamaño en px, default 28
    imgUrl?: string | null     // foto real, si existe — si no, cae a la inicial
}

export function Avatar({ name, size = 28, imgUrl }: AvatarProps) {
    // Suma los códigos ASCII de cada letra y hace módulo 360
    // para obtener un hue (0-359) estable y único por nombre
    const hue = name.trim().split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360

    if (imgUrl) {
        return (
            <img
                src={imgUrl}
                alt={name}
                style={{
                    width: size, height: size, borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0, display: 'block',
                }}
            />
        )
    }

    return (
        <div style={{
            width:        size,
            height:       size,
            borderRadius: '50%',
            // oklch: espacio de color moderno, más uniforme visualmente que hsl
            // 0.88 = luminosidad alta (claro), 0.08 = saturación baja (suave)
            background:   `oklch(0.88 0.08 ${hue})`,
            color:        `oklch(0.35 0.12 ${hue})`,
            display:      'grid',
            placeItems:   'center',
            fontSize:     size * 0.42,  // la inicial escala proporcional al tamaño
            fontWeight:   700,
            flexShrink:   0,            // no se achica dentro de flex containers
        }}>
            {name.trim()[0].toUpperCase()}
        </div>
    )
}