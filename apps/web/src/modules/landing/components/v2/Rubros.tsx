// Rubros y "próximamente".
//
// Los rubros NO son inventados: son exactamente los subrubros de Tienda que
// ofrece el onboarding real (TIENDA_SUBRUBROS en
// apps/api/src/onboarding/onboarding.service.ts), con su misma descripción. Eso
// es justamente lo que hace fuerte a esta sección: no dice "servís para todo",
// dice qué cambia en el panel según lo que vendas.
//
// La lista de "próximamente" también sale de ahí: son las categorías que hoy
// figuran con `disponible: false`. Se muestran como lo que son — todavía no
// están — en vez de prometerlas como si funcionaran.

import { Reveal, Seccion, Encabezado, Card } from './Reveal';

interface Rubro { nombre: string; detalle: string }

const RUBROS: Rubro[] = [
    { nombre: 'Indumentaria',            detalle: 'Talles, colores y variantes' },
    { nombre: 'Calzado',                 detalle: 'Numeración y variantes por talle' },
    { nombre: 'Perfumería y cosmética',  detalle: 'Vencimientos y control de lotes' },
    { nombre: 'Electrónica',             detalle: 'N° de serie / IMEI por unidad' },
    { nombre: 'Ferretería',              detalle: 'Miles de SKUs, venta por unidad' },
    { nombre: 'Corralón y construcción', detalle: 'Venta por m², kg o litro' },
    { nombre: 'Librería',                detalle: 'ISBN, editorial y autor' },
    { nombre: 'Juguetería',              detalle: 'Edad recomendada por producto' },
    { nombre: 'Pet shop',                detalle: 'Alimentos por peso y accesorios' },
    { nombre: 'Repuestos automotor',     detalle: 'Compatibilidad por modelo de vehículo' },
    { nombre: 'Joyería',                 detalle: 'Materiales, peso y tasación' },
    { nombre: 'Mueblería',               detalle: 'Medidas físicas y variantes de color' },
    { nombre: 'Informática',             detalle: 'Compatibilidades técnicas' },
    { nombre: 'Distribuidora mayorista', detalle: 'Precios escalonados por volumen' },
    { nombre: 'Limpieza',                detalle: 'Litros y concentración' },
    { nombre: 'Vivero',                  detalle: 'Productos vivos con cuidados especiales' },
    { nombre: 'Artística y mercería',    detalle: 'Variantes de color, material y medida' },
    { nombre: 'De todo un poco',         detalle: 'Tienda variada sin un rubro fijo' },
];

const PROXIMAMENTE = ['Turnos y agenda', 'Gastronomía', 'Servicios', 'Turismo', 'Educación', 'Eventos'];

export function Rubros() {
    return (
        <Seccion id="rubros">
            <Encabezado
                eyebrow="Rubros"
                titulo="No es un molde genérico:"
                resalte="el panel se arma según lo que vendés."
                bajada="Elegís tu rubro al empezar y Órbita configura las variantes, el control de stock y la ficha de producto que ese negocio necesita."
            />

            {/* En escritorio es una grilla de 18 tarjetas y se lee de un golpe.
                En celular esa misma grilla son 18 filas: media pantalla de scroll
                para una sección secundaria. Ahí pasa a ser un carrusel horizontal
                de dos filas con scroll-snap — se ve lo mismo, ocupa una pantalla,
                y el gesto de deslizar es el natural en el teléfono.

                Ojo: el Reveal va en el CONTENEDOR y no en cada tarjeta. Con uno
                por tarjeta, las que están fuera del scroll horizontal nunca
                entran en el viewport y se quedarían invisibles para siempre. */}
            <Reveal className="mt-14">
                <div
                    className="oc-rubros grid grid-flow-col grid-rows-2 gap-3 overflow-x-auto pb-3
                               sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3"
                >
                    {RUBROS.map(r => (
                        <Card key={r.nombre} className="oc-card-hover h-full snap-start px-5 py-4">
                            <h3 className="text-[14.5px] font-bold text-white">{r.nombre}</h3>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">{r.detalle}</p>
                        </Card>
                    ))}
                </div>

                <p className="mt-3 flex items-center justify-center gap-2 text-[11.5px] text-slate-500 sm:hidden">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    Deslizá para ver los {RUBROS.length} rubros
                </p>

                <style>{`
                    /* Solo en celular: dos filas, tarjetas de ancho fijo y snap. */
                    @media (max-width: 639px) {
                        .oc-rubros {
                            grid-auto-columns: 76%;
                            scroll-snap-type: x mandatory;
                            /* Que la primera y la última no queden pegadas al borde. */
                            scroll-padding-left: 4px;
                        }
                        /* Barra de scroll discreta, no la del sistema pisando el diseño. */
                        .oc-rubros::-webkit-scrollbar { height: 4px; }
                        .oc-rubros::-webkit-scrollbar-thumb {
                            background: var(--oc-card-bd); border-radius: 999px;
                        }
                    }
                `}</style>
            </Reveal>

            {/* Lo que todavía no está, dicho de frente. Genera expectativa sin
                prometer algo que hoy no funciona. */}
            <Reveal delay={120} className="mt-10">
                <Card className="p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span
                            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200"
                            style={{ background: 'rgba(217,119,6,.14)', border: '1px solid rgba(251,191,36,.24)' }}
                        >
                            En camino
                        </span>
                        <h3 className="text-[15px] font-bold text-white">Todavía no, pero está en construcción</h3>
                    </div>
                    <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed text-slate-400">
                        Hoy Órbita resuelve tiendas con productos y stock. Estos rubros necesitan agenda y reservas,
                        y llegan en las próximas etapas. Cuando estén, tu cuenta los va a tener sin migrar nada.
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                        {PROXIMAMENTE.map(p => (
                            <li
                                key={p}
                                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-slate-400"
                                style={{ border: '1px dashed var(--oc-card-bd)' }}
                            >
                                {p}
                            </li>
                        ))}
                    </ul>
                </Card>
            </Reveal>
        </Seccion>
    );
}
