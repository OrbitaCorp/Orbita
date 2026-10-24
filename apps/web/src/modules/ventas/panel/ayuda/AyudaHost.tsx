// ─── Ayuda del panel: primeros pasos, tutorial por módulo y sugerencias ──────
//
// Reemplaza al tutorial de bienvenida anterior (cinco variantes que movían a la
// persona de sección en sección). Dos reglas, pensadas para el celular:
//   · NUNCA navega solo: el usuario toca un botón y recién ahí cambia de pantalla.
//   · Una sola cosa a la vez: primeros pasos, o el aviso del módulo, o una sugerencia.
//
// 1. Primeros pasos (solo dueño/admin): UN flujo, "crear tu primer producto",
//    que empieza por la categoría. Un modal que lo pide, una tira fina y un
//    foco sobre el botón mientras lo hace, y un cierre cuando el producto
//    existe: verificar el correo y, después, "¿seguir creando productos o
//    personalizar tu página web?". Qué mostrar lo decide decidirPrimerosPasos.
// 2. Aviso por módulo: la primera vez que se entra a un módulo, una tarjeta
//    "¿Querés ver cómo funciona?" con [Ver tutorial] [Ahora no]. El tutorial es
//    el Recorrido: pasos cortos que señalan la pantalla real, sin navegar ni
//    mover nada (recorridos.ts cubre todos los módulos).
// 3. Sugerencias: de vez en cuando, "¿Ya sabés crear un descuento?" para lo que
//    todavía no hizo (la API lo sabe). Elige sugerencias.ts.
//
// Se monta en AdminLayout, debajo del banner de verificación de correo: la tira
// ocupa su lugar en el flujo; modales, tarjetas y sugerencias son fixed.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth/AuthContext'
import { adminPath } from '@/lib/tenant'
import { panelEstadoVerificacionEmail, panelGetCategoriesFlat, panelGetProductStats, panelGetTutorial } from '@/lib/api'
import { claveDeAyuda, recorridoDe } from './recorridos'
import { puedeUsarModoPrueba, comandoDeQuery, cumplidasSimuladas } from './acceso'
import {
    COPY_PASO, NOMBRES_DE_PASOS, SECCION_DEL_PASO, decidirPrimerosPasos, pasoInicial, type VistaPrimerosPasos,
} from './primerosPasos'
import {
    DESCARTADAS_PARA_SILENCIAR, ESPERA_INICIAL_MS, POSPONER_IGNORADA_MS, POSPONER_SUGERENCIA_MS, SILENCIO_MS,
    claveDeSugerencia, elegirSugerencia,
    type Sugerencia,
} from './sugerencias'
import { ESTADO_AYUDA_VACIO, POSPONER_MS, guardarAyuda, leerAyuda, type EstadoAyuda } from './almacen'
import { AvisoChico, EstilosAyuda, Tarjeta } from './piezas'
import Recorrido from './Recorrido'
import { EVENTO_ABRIR_AYUDA } from './AyudaBoton'
import Foco from './Foco'

// Mientras hay un paso a medias se vuelve a preguntar cada tanto: crear la
// categoría o el producto no cambia de ruta, y el cierre tiene que aparecer
// solo cuando el dato ya existe.
const REVISAR_CADA_MS = 3000

export default function AyudaHost() {
    const router = useRouter()
    const { user } = useAuth()
    const esMember = user?.type === 'member'
    const negocioId = user?.type === 'member' ? user.business.id : ''
    // El modo prueba (?ayuda=probar) es solo de la tienda "negocio" (ver acceso.ts).
    const modoPruebaPermitido = user?.type === 'member' && puedeUsarModoPrueba(user.business.subdomain)
    // Mismo criterio que el tutorial anterior: configurar la tienda es cosa del
    // dueño (o de un admin); a un empleado no se le pide cargar el catálogo.
    const esAdmin = user?.type === 'member' && (user.role === 'owner' || user.role === 'admin')

    const [ayuda, setAyuda] = useState<EstadoAyuda | null>(null)
    // "Más tarde" vigente. Se calcula al leer lo guardado y al tocarlo (no en el
    // render: la hora no es parte del estado de la pantalla).
    const [pospuesto, setPospuesto] = useState(false)
    const [cumplidasReales, setCumplidasReales] = useState<string[] | null>(null)
    const [fallo, setFallo] = useState(false)
    const [hojaAbierta, setHojaAbierta] = useState(false)
    // Clave del tutorial cuyo aviso se está mostrando ahora (no se vuelve a ofrecer).
    const [avisada, setAvisada] = useState<string | null>(null)
    const [avisoCerrado, setAvisoCerrado] = useState(false)
    // null = todavía no se sabe.
    const [correoVerificado, setCorreoVerificado] = useState<boolean | null>(null)
    // Sugerencia en pantalla, y la que se está confirmando ("No, mostrame").
    const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null)
    const [confirmando, setConfirmando] = useState<Sugerencia | null>(null)
    // Tutorial que la persona pidió con una sugerencia: se abre al llegar a su pantalla.
    const [pedida, setPedida] = useState<string | null>(null)

    const path = router.asPath.split(/[?#]/)[0]
    const segmentos = path.split('/').filter(Boolean)
    const seccion = segmentos[segmentos.length - 1] ?? ''
    const vista = typeof router.query.vista === 'string' ? router.query.vista : undefined
    // Qué tutorial corresponde a donde está parado (cada vista de Configuración tiene el suyo).
    const clave = claveDeAyuda(seccion, vista)

    // Lo recordado en este dispositivo (solo en el cliente).
    useEffect(() => {
        if (!negocioId) return
        let guardado = leerAyuda(negocioId)
        // La tienda de pruebas arranca SOLA como si fuera nueva (la primera vez en
        // cada navegador), para ver el flujo sin tener que armar la dirección.
        if (modoPruebaPermitido && !guardado.pruebaElegida) {
            guardado = { ...ESTADO_AYUDA_VACIO, prueba: 'categoria', pruebaElegida: true }
            guardarAyuda(negocioId, guardado)
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAyuda(guardado)
        setPospuesto(guardado.pospuestoHasta > Date.now())
    }, [negocioId, modoPruebaPermitido])

    const actualizarAyuda = useCallback((cambio: (a: EstadoAyuda) => EstadoAyuda) => {
        setAyuda(prev => {
            const base = prev ?? ESTADO_AYUDA_VACIO
            const nuevo = cambio(base)
            if (negocioId) guardarAyuda(negocioId, nuevo)
            return nuevo
        })
    }, [negocioId])
    // Para los temporizadores, que no deben reiniciarse cada vez que cambia el estado.
    const ayudaRef = useRef<EstadoAyuda | null>(null)
    useEffect(() => { ayudaRef.current = ayuda }, [ayuda])

    // Qué tiene hecho el negocio (categoría, producto, descuentos…), deducido por la API.
    const ultimaConsulta = useRef(0)
    const consultar = useCallback((forzar = false) => {
        if (!esAdmin) return
        const ahora = Date.now()
        if (!forzar && ahora - ultimaConsulta.current < 3000) return
        ultimaConsulta.current = ahora
        panelGetTutorial()
            .then(r => { setCumplidasReales(r.cumplidas); setFallo(false) })
            // Sin respuesta no se muestra nada de los primeros pasos: mejor un
            // panel limpio que una tarjeta que pide algo que quizás ya está.
            .catch(() => setFallo(true))
    }, [esAdmin])

    useEffect(() => {
        if (!router.isReady || !negocioId) return
        consultar()
    }, [router.isReady, path, negocioId, consultar])

    useEffect(() => {
        const alVolver = () => { if (document.visibilityState === 'visible') consultar() }
        window.addEventListener('focus', alVolver)
        document.addEventListener('visibilitychange', alVolver)
        return () => {
            window.removeEventListener('focus', alVolver)
            document.removeEventListener('visibilitychange', alVolver)
        }
    }, [consultar])

    // En el modo prueba (ver acceso.ts) se simula una tienda recién creada: no se
    // mira lo que hay en la base. Fuera de la prueba, lo que diga la API.
    const cumplidas = ayuda?.prueba && modoPruebaPermitido ? cumplidasSimuladas(ayuda.prueba) : cumplidasReales

    // ── Comandos de la dirección: ?ayuda=probar | reiniciar | salir ──
    const comando = modoPruebaPermitido ? comandoDeQuery(router.query.ayuda) : null
    useEffect(() => {
        if (!comando || !ayuda) return
        const { ayuda: _quitar, ...resto } = router.query
        void _quitar
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (comando === 'salir') actualizarAyuda(a => ({ ...a, prueba: null, pruebaElegida: true }))
        else actualizarAyuda(a => ({ ...ESTADO_AYUDA_VACIO, pruebaElegida: true, prueba: comando === 'probar' ? 'categoria' : a.prueba }))
        // Lo que estaba en pantalla de la vez anterior se descarta.
        setPospuesto(false)
        setAvisada(null); setAvisoCerrado(false); setHojaAbierta(false)
        setSugerencia(null); setConfirmando(null); setPedida(null); setCorreoVerificado(null)
        // La orden se consume: recargar la página no vuelve a reiniciar.
        void router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comando, !!ayuda])

    // ── Modo prueba: notar solo cuando se crea la categoría o el producto ──
    // La tienda de pruebas ya tiene de todo, así que no sirve preguntarle a la API
    // "¿hay algún producto?". En cambio se cuenta lo que hay al empezar cada paso y
    // se avanza cuando ese número sube: o sea, cuando la persona crea uno de verdad.
    const pasoDePrueba = modoPruebaPermitido ? ayuda?.prueba : null
    useEffect(() => {
        if (pasoDePrueba !== 'categoria' && pasoDePrueba !== 'producto') return
        let vigente = true
        const revisar = async () => {
            try {
                const [categorias, stats] = await Promise.all([panelGetCategoriesFlat(), panelGetProductStats()])
                if (!vigente) return
                const ahora = { categorias: categorias.length, productos: stats.total }
                const base = ayudaRef.current?.pruebaBase
                if (!base) { actualizarAyuda(a => ({ ...a, pruebaBase: ahora })); return }
                if (pasoDePrueba === 'categoria' && ahora.categorias > base.categorias) {
                    actualizarAyuda(a => ({ ...a, prueba: 'producto', pruebaBase: ahora }))
                } else if (pasoDePrueba === 'producto' && ahora.productos > base.productos) {
                    actualizarAyuda(a => ({ ...a, prueba: 'listo', pruebaBase: null }))
                }
            } catch { /* sin respuesta se vuelve a intentar en la próxima vuelta */ }
        }
        void revisar()
        const t = setInterval(() => void revisar(), 2500)
        return () => { vigente = false; clearInterval(t) }
    }, [pasoDePrueba, actualizarAyuda])

    const primeros: VistaPrimerosPasos = !esAdmin || !ayuda
        ? { tipo: 'nada' }
        : decidirPrimerosPasos({ cumplidas, seccion, vista, pospuesto, enCurso: ayuda.enCurso })

    // Quien llegó a ver el modal o la tira está "en curso": al crear el producto
    // se le muestra el cierre. Quien ya tenía todo hecho antes nunca lo ve.
    const hayPasoVisible = primeros.tipo === 'modal' || primeros.tipo === 'tira'
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (hayPasoVisible && ayuda && !ayuda.enCurso) actualizarAyuda(a => ({ ...a, enCurso: true }))
    }, [hayPasoVisible, ayuda, actualizarAyuda])

    // Con un paso a medias se revisa cada tanto si ya lo hizo.
    useEffect(() => {
        if (!hayPasoVisible) return
        const t = setInterval(() => consultar(true), REVISAR_CADA_MS)
        return () => clearInterval(t)
    }, [hayPasoVisible, consultar])

    // El cierre le avisa si falta verificar el correo; y si fue a verificarlo,
    // se vuelve a mirar hasta que lo haga, para preguntarle qué quiere hacer ahora.
    const hayCierre = primeros.tipo === 'listo'
    const esperando = !!ayuda?.esperaCorreo
    useEffect(() => {
        if (!hayCierre && !esperando) return
        let vigente = true
        const revisar = () => {
            panelEstadoVerificacionEmail()
                .then(e => { if (vigente) setCorreoVerificado(e.emailVerified) })
                // Sin respuesta se asume verificado: no se le pide verificar algo
                // que no podemos comprobar.
                .catch(() => { if (vigente) setCorreoVerificado(true) })
        }
        revisar()
        if (!esperando) return () => { vigente = false }
        const t = setInterval(revisar, REVISAR_CADA_MS)
        window.addEventListener('focus', revisar)
        return () => { vigente = false; clearInterval(t); window.removeEventListener('focus', revisar) }
    }, [hayCierre, esperando])

    // En la prueba el correo arranca "sin verificar" para poder ver ese paso; una
    // vez que fue a Mi perfil (esperando) vale lo que diga el sistema.
    const correoEf = ayuda?.prueba && !esperando ? false : correoVerificado
    // Con el producto creado y el correo verificado: qué sigue.
    const eleccionVisible = correoEf === true && (hayCierre || esperando)

    const ir = useCallback((destino: string, query?: Record<string, string>) => {
        const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
        void router.push(`${adminPath(negocioId, 'ventas', destino)}${qs}`)
    }, [router, negocioId])

    // ── Aviso por módulo ──
    // Espera a saber si hay primeros pasos pendientes (cumplidas o fallo) para
    // no mostrar dos cosas a la vez ni parpadear.
    const listoParaAviso = !!ayuda && (!esAdmin || cumplidas !== null || fallo)
    const modulo = recorridoDe(clave)
    // Un recorrido es de UNA pantalla: si la persona cambia de pantalla (por ejemplo, tocó
    // "Crear descuento"), el de la lista se cierra y no se queda flotando sobre el formulario.
    // Si el cambio vino de tocar lo señalado, `encadenar` abre la guía que sigue.
    const clavePrevia = useRef(clave)
    useEffect(() => {
        if (clavePrevia.current === clave) return
        clavePrevia.current = clave
        setHojaAbierta(false)
    }, [clave])

    const libre = esMember && listoParaAviso && primeros.tipo === 'nada' && !eleccionVisible && !!modulo
    const ofrecer = libre && !ayuda?.vistos.includes(clave)
    // Pidió este tutorial desde una sugerencia: se abre directo, sin preguntarle de nuevo.
    const pedidaAqui = libre && pedida === clave
    useEffect(() => {
        if (!pedidaAqui && !ofrecer) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAvisada(clave)
        setAvisoCerrado(pedidaAqui)
        setHojaAbierta(pedidaAqui)
        if (pedidaAqui) setPedida(null)
        actualizarAyuda(a => (a.vistos.includes(clave) ? a : { ...a, vistos: [...a.vistos, clave] }))
    }, [pedidaAqui, ofrecer, clave, actualizarAyuda])

    // Tocó lo señalado en un paso que sigue con otra guía: se cierra esta y, cuando el
    // formulario (o la ventana) ya está en pantalla, se abre la que sigue.
    const encadenar = useCallback((siguiente: string) => {
        setHojaAbierta(false)
        setTimeout(() => {
            if (!recorridoDe(siguiente)) return
            setAvisada(siguiente)
            setAvisoCerrado(true)
            setSugerencia(null)
            setHojaAbierta(true)
            actualizarAyuda(a => (a.vistos.includes(siguiente) ? a : { ...a, vistos: [...a.vistos, siguiente] }))
        }, 600)
    }, [actualizarAyuda])

    // El botón "?" de la barra de arriba abre el tutorial de la pantalla cuando se quiera.
    const claveRef = useRef(clave)
    useEffect(() => { claveRef.current = clave })
    useEffect(() => {
        const abrir = () => {
            if (!recorridoDe(claveRef.current)) return
            setAvisada(claveRef.current)
            setAvisoCerrado(true)
            setSugerencia(null)
            setHojaAbierta(true)
        }
        window.addEventListener(EVENTO_ABRIR_AYUDA, abrir)
        return () => window.removeEventListener(EVENTO_ABRIR_AYUDA, abrir)
    }, [])

    // ── Sugerencias ──
    // Solo a quien ya terminó los primeros pasos y no tiene nada más en pantalla.
    const avisoVisible = avisada === clave && !avisoCerrado && !hojaAbierta
    const puedeSugerir = esAdmin && !!ayuda && cumplidas !== null && pasoInicial(cumplidas) === 'listo'
        && primeros.tipo === 'nada' && !eleccionVisible && !avisoVisible && !hojaAbierta && !confirmando
    useEffect(() => {
        if (!puedeSugerir || sugerencia || !cumplidas) return
        // En la prueba no se espera 25 segundos ni se respeta el intervalo entre sugerencias.
        const t = setTimeout(() => {
            const a = ayudaRef.current
            if (!a) return
            const elegida = elegirSugerencia({
                cumplidas, sabe: a.sabe, posponer: a.posponer, ultima: a.prueba ? 0 : a.ultimaSugerencia,
                silenciadoHasta: a.prueba ? 0 : a.silenciadoHasta,
                ahora: Date.now(), claveActual: clave,
            })
            if (!elegida) return
            setSugerencia(elegida)
            actualizarAyuda(x => ({ ...x, ultimaSugerencia: Date.now() }))
        }, ayudaRef.current?.prueba ? 4000 : ESPERA_INICIAL_MS)
        return () => clearTimeout(t)
    }, [puedeSugerir, sugerencia, cumplidas, clave, actualizarAyuda])

    // Si en el medio apareció otra cosa (un modal, un tutorial), la sugerencia se baja.
    const sugerenciaVisible = puedeSugerir ? sugerencia : null

    const posponerSugerencia = (s: Sugerencia, ms: number) =>
        actualizarAyuda(a => ({ ...a, posponer: { ...a.posponer, [s.id]: Date.now() + ms } }))
    // Contestó (sí sé / no, mostrame): vuelve a contar desde cero las que dejó pasar.
    const respondida = () => actualizarAyuda(a => ({ ...a, descartadasSeguidas: 0 }))
    // La cerró o la ignoró. Con varias seguidas se entiende que no las quiere: se callan todas un tiempo.
    const descartada = (s: Sugerencia, ms: number) => actualizarAyuda(a => {
        const seguidas = a.descartadasSeguidas + 1
        const silenciar = seguidas >= DESCARTADAS_PARA_SILENCIAR
        return {
            ...a,
            posponer: { ...a.posponer, [s.id]: Date.now() + ms },
            descartadasSeguidas: silenciar ? 0 : seguidas,
            silenciadoHasta: silenciar ? Date.now() + SILENCIO_MS : a.silenciadoHasta,
        }
    })

    if (!esMember || !ayuda) return null

    const recorridoAbierto = hojaAbierta ? recorridoDe(avisada ?? clave) : null
    const recorridoNodo = recorridoAbierto && (
        <Recorrido
            recorrido={recorridoAbierto}
            onCerrar={() => { setHojaAbierta(false); setAvisoCerrado(true) }}
            onAbrir={encadenar}
        />
    )

    // ── Primeros pasos ──
    if (primeros.tipo === 'tira') {
        // El foco resalta el botón de entrada de cada paso. Dentro del formulario
        // del producto no hay uno solo que tocar (son varios campos), así que ahí
        // acompaña únicamente la tira.
        const foco = primeros.paso === 'categoria'
            ? { objetivo: 'nueva-categoria', texto: 'Tocá acá para crear tu primera categoría' }
            : vista === 'nuevo' ? null : { objetivo: 'crear-producto', texto: 'Tocá acá para cargar tu primer producto' }
        return (
            <>
                <div role="status" style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '9px 16px', fontSize: 13.5, lineHeight: 1.45, color: 'var(--color-text)',
                    background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)',
                }}>
                    <span style={{ flex: '1 1 240px' }}>{primeros.texto}</span>
                    {/* Solo en el modo prueba: los pasos avanzan solos al crear la categoría y el
                        producto de verdad (se cuentan); esto es solo para salir. */}
                    {ayuda.prueba && (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                            <EstilosAyuda />
                            <button type="button" className="ayu-btn ayu-btn-txt" style={{ minHeight: 32, padding: '0 10px', fontSize: 13 }}
                                onClick={() => actualizarAyuda(a => ({ ...a, prueba: null, pruebaBase: null }))}>
                                Salir de la prueba
                            </button>
                        </span>
                    )}
                </div>
                {foco && (
                    <Foco
                        key={foco.objetivo}
                        objetivo={foco.objetivo}
                        texto={foco.texto}
                        // Al tocar el botón señalado, la guía del formulario o de la ventana que se abre.
                        alTocar={() => encadenar(primeros.paso === 'categoria' ? 'categorias/nueva' : 'catalogo/nuevo')}
                    />
                )}
                {recorridoNodo}
            </>
        )
    }
    if (primeros.tipo === 'modal') {
        const c = primeros.paso === 'producto' && seccion === 'categorias'
            ? COPY_PASO.productoTrasCategoria
            : COPY_PASO[primeros.paso]
        return (
            <>
                <EstilosAyuda />
                <Tarjeta
                    pasos={{ actual: c.numero, nombres: NOMBRES_DE_PASOS }}
                    etiqueta={`Paso ${c.numero} de 2`}
                    titulo={c.titulo}
                    texto={c.texto}
                    boton={c.boton}
                    onBoton={() => {
                        ir(SECCION_DEL_PASO[primeros.paso], primeros.paso === 'producto' ? { vista: 'nuevo' } : undefined)
                        // En el formulario del producto la guía arranca sola; en Categorías primero se señala el botón.
                        if (primeros.paso === 'producto') encadenar('catalogo/nuevo')
                    }}
                    secundario="Más tarde"
                    onSecundario={() => { setPospuesto(true); actualizarAyuda(a => ({ ...a, pospuestoHasta: Date.now() + POSPONER_MS })) }}
                />
            </>
        )
    }
    if (eleccionVisible) {
        const cerrar = () => actualizarAyuda(a => ({ ...a, enCurso: false, esperaCorreo: false }))
        return (
            <>
                <EstilosAyuda />
                <Tarjeta
                    etiqueta="Listo"
                    titulo="¿Qué querés hacer ahora?"
                    texto="Ya tenés tu primer producto y tu correo verificado. ¿Querés seguir creando productos o ver cómo personalizar tu página web?"
                    boton="Seguir creando productos"
                    onBoton={() => { cerrar(); ir('catalogo', { vista: 'nuevo' }) }}
                    secundario="Personalizar mi página web"
                    onSecundario={() => { cerrar(); setPedida('configuracion/apariencia'); ir('configuracion', { vista: 'apariencia' }) }}
                    terciario="Ahora no"
                    onTerciario={cerrar}
                    cerrar={cerrar}
                />
            </>
        )
    }
    if (primeros.tipo === 'listo') {
        // Hasta saber si el correo está verificado no se muestra nada: evita un
        // parpadeo del cierre equivocado.
        if (correoEf === null) return null
        const cerrar = () => actualizarAyuda(a => ({ ...a, enCurso: false }))
        return (
            <>
                <EstilosAyuda />
                <Tarjeta
                    etiqueta="Listo"
                    titulo="¡Ya tenés tu primer producto!"
                    texto="Tu tienda ya tiene algo para mostrar. Último paso: verificá tu correo para poder recuperar tu cuenta si alguna vez perdés el acceso."
                    boton="Verificar mi correo"
                    onBoton={() => { actualizarAyuda(a => ({ ...a, enCurso: false, esperaCorreo: true })); ir('perfil') }}
                    secundario="Después"
                    onSecundario={cerrar}
                    cerrar={cerrar}
                />
            </>
        )
    }

    // ── Aviso por módulo, tutorial y sugerencias ──
    return (
        <>
            <EstilosAyuda />
            {avisoVisible && modulo && (
                <AvisoChico
                    region="Tutorial del módulo"
                    texto={modulo.pregunta ?? `¿Querés ver cómo funciona ${modulo.titulo}?`}
                    principal="Ver tutorial"
                    onPrincipal={() => setHojaAbierta(true)}
                    secundaria="Ahora no"
                    onSecundaria={() => setAvisoCerrado(true)}
                    onCerrar={() => setAvisoCerrado(true)}
                />
            )}
            {recorridoNodo}
            {sugerenciaVisible && (
                <AvisoChico
                    region="Sugerencia de tutorial"
                    texto={`¿Ya sabés ${sugerenciaVisible.accion}?`}
                    principal="No, mostrame"
                    onPrincipal={() => { respondida(); setConfirmando(sugerenciaVisible); setSugerencia(null) }}
                    secundaria="Sí, ya sé"
                    onSecundaria={() => {
                        respondida()
                        actualizarAyuda(a => ({ ...a, sabe: [...a.sabe, sugerenciaVisible.id] }))
                        setSugerencia(null)
                    }}
                    onCerrar={() => { descartada(sugerenciaVisible, POSPONER_SUGERENCIA_MS); setSugerencia(null) }}
                    onExpira={() => { descartada(sugerenciaVisible, POSPONER_IGNORADA_MS); setSugerencia(null) }}
                />
            )}
            {confirmando && (
                <Tarjeta
                    etiqueta="Tutorial"
                    titulo={`Aprendé a ${confirmando.accion}`}
                    texto="Te mostramos qué significa cada cosa y cómo se hace, en pantallas cortas. Lo podés omitir cuando quieras."
                    boton="Empezar"
                    onBoton={() => {
                        const s = confirmando
                        setConfirmando(null)
                        setPedida(claveDeSugerencia(s))
                        ir(s.seccion, s.vista ? { vista: s.vista } : undefined)
                    }}
                    secundario="Más tarde"
                    onSecundario={() => { posponerSugerencia(confirmando, POSPONER_SUGERENCIA_MS); setConfirmando(null) }}
                />
            )}
        </>
    )
}
