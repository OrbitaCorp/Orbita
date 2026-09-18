// Modelos de variantes y de ficha técnica por subrubro — lo que el alta de
// producto (ProductoNuevo.tsx) ofrece según lo que el negocio eligió que vende
// en el paso 1 del wizard.
//
// Las claves son las `key` de TIENDA_SUBRUBROS (apps/api/src/onboarding/
// onboarding.service.ts). Un subrubro sin entrada acá no rompe nada: cae a
// GENERICOS, igual que "De todo un poco".
//
// Dos cosas distintas, a propósito:
//
//   · VARIANTES: lo que cambia el precio o el stock de cada unidad (talle,
//     color, capacidad, sabor). Cada cruce es una combinación con su propio
//     precio y stock. Tope de tres opciones por modelo, el mismo del
//     formulario.
//   · SPECS: lo que describe al producto entero y no cambia entre unidades
//     (autor, editorial, garantía, material). Van a la ficha técnica. El ISBN
//     de un libro no es una variante: todas las unidades tienen el mismo.
//
// Lo que NO está acá, aunque un rubro lo necesite: el N° de serie / IMEI de
// cada unidad (Electrónica, Informática) y la venta fraccionada por metro,
// kilo o litro (Corralón, Mercería, Dietética). Ninguna de las dos es una
// variante —un IMEI es de UNA unidad, no de un modelo— y el stock de Órbita
// todavía no las soporta (existe la columna `inventoryType` en products, pero
// ningún código la lee). Donde el rubro vende por medida, el modelo ofrece
// PRESENTACIONES fijas (bolsa de 25 kg, 1 m, 500 g), que es lo que el stock
// sí sabe contar.
//
// `valores` son las sugerencias que se ofrecen con un clic; `pre` las que
// arrancan tildadas. Sin `pre`, arrancan todas. Los colores nunca arrancan
// tildados: adivinar los colores de una tienda es peor que no sugerir, y
// tildarlos todos multiplicaría las combinaciones por doce.

export interface OpcionPreset {
    nombre: string
    valores: string[]
    pre?: string[]
}

export interface PresetVariantes {
    id: string
    /** Qué tipo de producto es, dicho como lo diría el vendedor. */
    nombre: string
    opciones: OpcionPreset[]
}

export interface PresetsRubro {
    variantes: PresetVariantes[]
    specs: string[]
}

// ─── Listas compartidas ──────────────────────────────────────────────────────

const COLORES = ['Negro', 'Blanco', 'Gris', 'Azul', 'Celeste', 'Rojo', 'Verde', 'Amarillo', 'Rosa', 'Violeta', 'Beige', 'Marrón']
const COLOR: OpcionPreset = { nombre: 'Color', valores: COLORES, pre: [] }

const TALLES_LETRA: OpcionPreset = { nombre: 'Talle', valores: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], pre: ['S', 'M', 'L', 'XL'] }
const TALLES_NUMERO: OpcionPreset = { nombre: 'Talle', valores: ['34', '36', '38', '40', '42', '44', '46', '48', '50'], pre: ['38', '40', '42', '44'] }
const TALLES_NENES: OpcionPreset = { nombre: 'Talle', valores: ['2', '4', '6', '8', '10', '12', '14', '16'], pre: ['4', '6', '8', '10', '12'] }
const TALLES_BEBE: OpcionPreset = {
    nombre: 'Talle',
    valores: ['Recién nacido', '0-3 meses', '3-6 meses', '6-9 meses', '9-12 meses', '12-18 meses', '18-24 meses'],
    pre: ['0-3 meses', '3-6 meses', '6-9 meses', '9-12 meses'],
}

const NUMEROS_ADULTO: OpcionPreset = {
    nombre: 'Número',
    valores: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
    pre: ['36', '37', '38', '39', '40', '41', '42'],
}
const NUMEROS_NENES: OpcionPreset = {
    nombre: 'Número',
    valores: ['18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'],
    pre: ['22', '23', '24', '25', '26', '27', '28', '29'],
}

const MEDIDA_CAMA: OpcionPreset = {
    nombre: 'Medida',
    valores: ['1 plaza', '1½ plaza', '2 plazas', 'Queen', 'King'],
    pre: ['1 plaza', '2 plazas', 'Queen'],
}

// ─── Por subrubro ────────────────────────────────────────────────────────────

export const GENERICOS: PresetsRubro = {
    variantes: [
        { id: 'gen-talle-color', nombre: 'Talle y color', opciones: [TALLES_LETRA, COLOR] },
        { id: 'gen-color', nombre: 'Solo color', opciones: [COLOR] },
        { id: 'gen-tamano', nombre: 'Tamaño', opciones: [{ nombre: 'Tamaño', valores: ['Chico', 'Mediano', 'Grande'] }, COLOR] },
        { id: 'gen-presentacion', nombre: 'Presentación', opciones: [{ nombre: 'Presentación', valores: ['Unidad', 'Pack x 3', 'Pack x 6', 'Pack x 12'], pre: ['Unidad'] }] },
    ],
    specs: ['Marca', 'Material', 'Medidas', 'Garantía'],
}

export const PRESETS: Record<string, PresetsRubro> = {
    indumentaria: {
        variantes: [
            { id: 'ind-letras', nombre: 'Ropa (talle en letras)', opciones: [TALLES_LETRA, COLOR] },
            { id: 'ind-numeros', nombre: 'Pantalones y jeans (talle en número)', opciones: [TALLES_NUMERO, COLOR] },
            { id: 'ind-nenes', nombre: 'Ropa de chicos', opciones: [TALLES_NENES, COLOR] },
            { id: 'ind-unico', nombre: 'Talle único', opciones: [COLOR] },
        ],
        specs: ['Material', 'Composición', 'Calce', 'Temporada', 'Cuidados'],
    },

    calzado: {
        variantes: [
            { id: 'cal-adulto', nombre: 'Calzado adulto', opciones: [NUMEROS_ADULTO, COLOR] },
            { id: 'cal-nenes', nombre: 'Calzado de chicos', opciones: [NUMEROS_NENES, COLOR] },
            { id: 'cal-ojotas', nombre: 'Ojotas y pantuflas (número doble)', opciones: [{ nombre: 'Número', valores: ['33/34', '35/36', '37/38', '39/40', '41/42', '43/44'], pre: ['35/36', '37/38', '39/40', '41/42'] }, COLOR] },
        ],
        specs: ['Material exterior', 'Suela', 'Plantilla', 'Altura del taco', 'Horma'],
    },

    cosmetica: {
        variantes: [
            { id: 'cos-perfume', nombre: 'Perfume o fragancia', opciones: [{ nombre: 'Tamaño', valores: ['15 ml', '30 ml', '50 ml', '100 ml', '200 ml'], pre: ['50 ml', '100 ml'] }] },
            { id: 'cos-tonos', nombre: 'Maquillaje por tono', opciones: [{ nombre: 'Tono', valores: ['Muy claro', 'Claro', 'Medio claro', 'Medio', 'Medio oscuro', 'Oscuro', 'Muy oscuro'], pre: [] }] },
            { id: 'cos-cuidado', nombre: 'Cuidado de piel y cabello', opciones: [{ nombre: 'Contenido', valores: ['30 ml', '50 ml', '100 ml', '250 ml', '500 ml', '1 L'], pre: ['250 ml', '500 ml'] }] },
            { id: 'cos-esmalte', nombre: 'Esmaltes y labiales', opciones: [COLOR] },
        ],
        specs: ['Marca', 'Tipo de piel', 'Ingredientes principales', 'Vencimiento', 'Libre de crueldad animal', 'Origen'],
    },

    electronica: {
        variantes: [
            {
                id: 'ele-celular', nombre: 'Celular o tablet',
                opciones: [
                    { nombre: 'Almacenamiento', valores: ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB'], pre: ['128 GB', '256 GB'] },
                    COLOR,
                    { nombre: 'Condición', valores: ['Nuevo', 'Reacondicionado', 'Usado'], pre: ['Nuevo'] },
                ],
            },
            { id: 'ele-tv', nombre: 'TV o monitor', opciones: [{ nombre: 'Pantalla', valores: ['24"', '27"', '32"', '43"', '50"', '55"', '65"', '75"'], pre: ['32"', '43"', '50"', '55"'] }] },
            { id: 'ele-audio', nombre: 'Audio y accesorios', opciones: [COLOR] },
            { id: 'ele-consola', nombre: 'Consola o gaming', opciones: [{ nombre: 'Almacenamiento', valores: ['512 GB', '825 GB', '1 TB', '2 TB'] }, { nombre: 'Edición', valores: ['Estándar', 'Digital'] }] },
        ],
        specs: ['Marca', 'Modelo', 'Garantía', 'Memoria RAM', 'Batería', 'Pantalla', 'Conectividad'],
    },

    ferreteria: {
        variantes: [
            { id: 'fer-bulon', nombre: 'Tornillos y bulones', opciones: [{ nombre: 'Medida', valores: ['3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm', '12 mm'], pre: ['4 mm', '6 mm', '8 mm'] }, { nombre: 'Largo', valores: ['10 mm', '20 mm', '30 mm', '40 mm', '50 mm', '60 mm', '80 mm', '100 mm'], pre: ['20 mm', '30 mm', '40 mm'] }, { nombre: 'Presentación', valores: ['Unidad', 'Bolsa x 10', 'Bolsa x 50', 'Caja x 100'], pre: ['Unidad', 'Bolsa x 50'] }] },
            { id: 'fer-pintura', nombre: 'Pinturas', opciones: [{ nombre: 'Capacidad', valores: ['1 L', '4 L', '10 L', '20 L'], pre: ['1 L', '4 L', '20 L'] }, COLOR] },
            { id: 'fer-inalambrica', nombre: 'Herramienta a batería', opciones: [{ nombre: 'Voltaje', valores: ['12 V', '18 V', '20 V'] }, { nombre: 'Batería', valores: ['Sin batería', '1 batería', '2 baterías'] }] },
            { id: 'fer-mechas', nombre: 'Mechas y brocas', opciones: [{ nombre: 'Diámetro', valores: ['3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm', '12 mm'] }] },
        ],
        specs: ['Marca', 'Material', 'Potencia', 'Uso recomendado', 'Garantía'],
    },

    corralon: {
        variantes: [
            { id: 'cor-bolsa', nombre: 'Por bolsa (cemento, cal, arena)', opciones: [{ nombre: 'Presentación', valores: ['Bolsa 25 kg', 'Bolsa 30 kg', 'Bolsa 40 kg', 'Bolsa 50 kg', 'Bolsón (1 m³)'], pre: ['Bolsa 25 kg', 'Bolsa 50 kg'] }] },
            { id: 'cor-hierro', nombre: 'Hierros y caños', opciones: [{ nombre: 'Diámetro', valores: ['4,2 mm', '6 mm', '8 mm', '10 mm', '12 mm', '16 mm'], pre: ['6 mm', '8 mm', '10 mm', '12 mm'] }, { nombre: 'Largo', valores: ['6 m', '12 m'], pre: ['12 m'] }] },
            { id: 'cor-ceramico', nombre: 'Cerámicos y porcelanatos', opciones: [{ nombre: 'Formato', valores: ['30x30', '35x35', '45x45', '60x60', '30x60', '60x120'], pre: ['45x45', '60x60'] }, COLOR] },
            { id: 'cor-pintura', nombre: 'Pinturas e impermeabilizantes', opciones: [{ nombre: 'Capacidad', valores: ['1 L', '4 L', '10 L', '20 L'], pre: ['4 L', '10 L', '20 L'] }, COLOR] },
        ],
        specs: ['Marca', 'Rendimiento', 'Uso', 'Tiempo de secado', 'Origen'],
    },

    libreria: {
        variantes: [
            { id: 'lib-libro', nombre: 'Libros', opciones: [{ nombre: 'Formato', valores: ['Tapa blanda', 'Tapa dura', 'Bolsillo'], pre: ['Tapa blanda'] }] },
            { id: 'lib-cuaderno', nombre: 'Cuadernos', opciones: [{ nombre: 'Tamaño', valores: ['A4', 'A5', '16x21', '19x24', 'Oficio'], pre: ['A4', '19x24'] }, { nombre: 'Rayado', valores: ['Rayado', 'Cuadriculado', 'Liso'] }, { nombre: 'Hojas', valores: ['48', '80', '84', '96', '120', '200'], pre: ['48', '84'] }] },
            { id: 'lib-util', nombre: 'Útiles escolares', opciones: [COLOR] },
            { id: 'lib-resma', nombre: 'Papel y resmas', opciones: [{ nombre: 'Tamaño', valores: ['A4', 'Carta', 'Oficio'], pre: ['A4'] }, { nombre: 'Gramaje', valores: ['70 g', '75 g', '80 g'], pre: ['75 g'] }] },
        ],
        specs: ['Autor', 'Editorial', 'ISBN', 'Páginas', 'Idioma', 'Año de edición'],
    },

    jugueteria: {
        variantes: [
            { id: 'jug-color', nombre: 'Juguete por color', opciones: [COLOR] },
            { id: 'jug-tamano', nombre: 'Peluches y regalos por tamaño', opciones: [{ nombre: 'Tamaño', valores: ['Chico', 'Mediano', 'Grande', 'Gigante'], pre: ['Chico', 'Mediano', 'Grande'] }, COLOR] },
            { id: 'jug-personaje', nombre: 'Por personaje o modelo', opciones: [{ nombre: 'Modelo', valores: [], pre: [] }] },
        ],
        specs: ['Edad recomendada', 'Material', 'Medidas', 'Pilas incluidas', 'Marca'],
    },

    petshop: {
        variantes: [
            { id: 'pet-alimento', nombre: 'Alimento balanceado', opciones: [{ nombre: 'Peso', valores: ['500 g', '1 kg', '3 kg', '7,5 kg', '10 kg', '15 kg', '20 kg', '22 kg'], pre: ['3 kg', '7,5 kg', '15 kg'] }, { nombre: 'Etapa', valores: ['Cachorro', 'Adulto', 'Senior'], pre: ['Adulto'] }] },
            { id: 'pet-accesorio', nombre: 'Collares, camas y ropa', opciones: [{ nombre: 'Tamaño', valores: ['XS', 'S', 'M', 'L', 'XL'], pre: ['S', 'M', 'L'] }, COLOR] },
            { id: 'pet-piedras', nombre: 'Piedras sanitarias y arena', opciones: [{ nombre: 'Peso', valores: ['2 kg', '4 kg', '10 kg', '20 kg'], pre: ['4 kg', '10 kg'] }] },
        ],
        specs: ['Especie', 'Tamaño de raza', 'Sabor', 'Marca', 'Edad'],
    },

    repuestos: {
        variantes: [
            { id: 'rep-lado', nombre: 'Repuesto por lado', opciones: [{ nombre: 'Lado', valores: ['Izquierdo', 'Derecho'] }, { nombre: 'Posición', valores: ['Delantero', 'Trasero'] }] },
            { id: 'rep-neumatico', nombre: 'Neumáticos', opciones: [{ nombre: 'Medida', valores: ['165/70 R13', '175/65 R14', '185/60 R15', '185/65 R15', '195/55 R16', '205/55 R16', '215/60 R17', '225/45 R17'], pre: ['175/65 R14', '185/60 R15', '195/55 R16'] }] },
            { id: 'rep-lubricante', nombre: 'Lubricantes y fluidos', opciones: [{ nombre: 'Capacidad', valores: ['1 L', '4 L', '5 L', '20 L'], pre: ['1 L', '4 L'] }, { nombre: 'Viscosidad', valores: ['5W30', '10W40', '15W40', '20W50'], pre: [] }] },
            { id: 'rep-modelo', nombre: 'Por modelo de vehículo', opciones: [{ nombre: 'Modelo', valores: [], pre: [] }] },
        ],
        specs: ['Marca', 'Código OEM', 'Vehículos compatibles', 'Años', 'Garantía'],
    },

    joyeria: {
        variantes: [
            { id: 'joy-anillo', nombre: 'Anillos', opciones: [{ nombre: 'Talle', valores: ['10', '12', '14', '16', '18', '20', '22', '24', '26'], pre: ['14', '16', '18', '20'] }, { nombre: 'Material', valores: ['Plata 925', 'Oro 18k', 'Acero quirúrgico', 'Baño de oro'], pre: [] }] },
            { id: 'joy-cadena', nombre: 'Cadenas y collares', opciones: [{ nombre: 'Largo', valores: ['40 cm', '45 cm', '50 cm', '60 cm', '70 cm'], pre: ['45 cm', '50 cm'] }, { nombre: 'Material', valores: ['Plata 925', 'Oro 18k', 'Acero quirúrgico', 'Baño de oro'], pre: [] }] },
            { id: 'joy-material', nombre: 'Por material', opciones: [{ nombre: 'Material', valores: ['Plata 925', 'Oro 18k', 'Acero quirúrgico', 'Baño de oro'] }] },
        ],
        specs: ['Material', 'Peso', 'Piedra', 'Medidas', 'Garantía'],
    },

    muebleria: {
        variantes: [
            { id: 'mue-terminacion', nombre: 'Muebles por terminación', opciones: [{ nombre: 'Terminación', valores: ['Blanco', 'Negro', 'Roble', 'Nogal', 'Wengue', 'Gris', 'Natural'], pre: [] }] },
            { id: 'mue-colchon', nombre: 'Colchones y sommiers', opciones: [{ nombre: 'Medida', valores: ['1 plaza (80x190)', '1½ plaza (100x190)', '2 plazas (140x190)', 'Queen (160x200)', 'King (200x200)'], pre: ['1 plaza (80x190)', '2 plazas (140x190)', 'Queen (160x200)'] }] },
            { id: 'mue-silla', nombre: 'Sillas y sillones por tapizado', opciones: [{ nombre: 'Tapizado', valores: ['Pana', 'Cuero ecológico', 'Lino', 'Chenille'], pre: [] }, COLOR] },
        ],
        specs: ['Medidas (alto x ancho x profundidad)', 'Material', 'Peso', 'Requiere armado', 'Garantía'],
    },

    informatica: {
        variantes: [
            { id: 'inf-notebook', nombre: 'Notebooks y PCs', opciones: [{ nombre: 'Memoria RAM', valores: ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB'], pre: ['8 GB', '16 GB'] }, { nombre: 'Almacenamiento', valores: ['256 GB SSD', '512 GB SSD', '1 TB SSD', '2 TB SSD', '1 TB HDD'], pre: ['256 GB SSD', '512 GB SSD'] }] },
            { id: 'inf-periferico', nombre: 'Periféricos', opciones: [{ nombre: 'Conexión', valores: ['USB', 'Inalámbrico', 'Bluetooth'] }, COLOR] },
            { id: 'inf-almacenamiento', nombre: 'Pendrives y discos', opciones: [{ nombre: 'Capacidad', valores: ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'], pre: ['64 GB', '128 GB', '256 GB'] }] },
            { id: 'inf-componente', nombre: 'Memorias y componentes', opciones: [{ nombre: 'Capacidad', valores: ['8 GB', '16 GB', '32 GB'] }, { nombre: 'Tipo', valores: ['DDR4', 'DDR5'] }] },
        ],
        specs: ['Marca', 'Modelo', 'Procesador', 'Pantalla', 'Sistema operativo', 'Garantía'],
    },

    mayorista: {
        variantes: [
            { id: 'may-bulto', nombre: 'Por bulto', opciones: [{ nombre: 'Presentación', valores: ['Unidad', 'Pack x 6', 'Pack x 12', 'Caja x 24', 'Caja x 48', 'Pallet'], pre: ['Unidad', 'Pack x 12', 'Caja x 24'] }] },
            { id: 'may-sabor', nombre: 'Por bulto y sabor', opciones: [{ nombre: 'Presentación', valores: ['Pack x 6', 'Pack x 12', 'Caja x 24'], pre: ['Pack x 12'] }, { nombre: 'Sabor', valores: [], pre: [] }] },
        ],
        specs: ['Marca', 'Unidades por bulto', 'Código de barras (EAN)', 'Peso del bulto'],
    },

    limpieza: {
        variantes: [
            { id: 'lim-liquido', nombre: 'Productos líquidos', opciones: [{ nombre: 'Capacidad', valores: ['500 ml', '750 ml', '1 L', '2 L', '5 L', '20 L'], pre: ['1 L', '5 L'] }, { nombre: 'Fragancia', valores: ['Original', 'Lavanda', 'Limón', 'Floral', 'Marina', 'Pino'], pre: [] }] },
            { id: 'lim-accesorio', nombre: 'Trapos, esponjas y escobas', opciones: [COLOR, { nombre: 'Presentación', valores: ['Unidad', 'Pack x 3', 'Pack x 6'], pre: ['Unidad'] }] },
            { id: 'lim-polvo', nombre: 'Jabón en polvo', opciones: [{ nombre: 'Peso', valores: ['400 g', '800 g', '3 kg', '5 kg'], pre: ['800 g', '3 kg'] }] },
        ],
        specs: ['Marca', 'Rendimiento', 'Dilución', 'Uso recomendado', 'Biodegradable'],
    },

    vivero: {
        variantes: [
            { id: 'viv-planta', nombre: 'Plantas', opciones: [{ nombre: 'Maceta', valores: ['Maceta N°10', 'Maceta N°12', 'Maceta N°14', 'Maceta N°18', 'Maceta N°20', 'Maceta N°24', 'Maceta N°30'], pre: ['Maceta N°12', 'Maceta N°14', 'Maceta N°18'] }] },
            { id: 'viv-tierra', nombre: 'Tierra, sustratos y abonos', opciones: [{ nombre: 'Presentación', valores: ['5 L', '10 L', '25 L', '50 L'], pre: ['5 L', '25 L', '50 L'] }] },
            { id: 'viv-maceta', nombre: 'Macetas', opciones: [{ nombre: 'Diámetro', valores: ['10 cm', '14 cm', '18 cm', '24 cm', '30 cm', '40 cm'], pre: ['14 cm', '18 cm', '24 cm'] }, COLOR] },
        ],
        specs: ['Luz', 'Riego', 'Interior o exterior', 'Altura aproximada', 'Apta mascotas'],
    },

    artistica: {
        variantes: [
            { id: 'art-pintura', nombre: 'Acrílicos y óleos', opciones: [COLOR, { nombre: 'Contenido', valores: ['20 ml', '60 ml', '120 ml', '250 ml', '500 ml'], pre: ['60 ml', '250 ml'] }] },
            { id: 'art-lienzo', nombre: 'Lienzos y bastidores', opciones: [{ nombre: 'Medida', valores: ['20x30', '30x40', '40x50', '50x70', '60x80', '70x100'], pre: ['20x30', '30x40', '40x50', '50x70'] }] },
            { id: 'art-pincel', nombre: 'Pinceles', opciones: [{ nombre: 'Número', valores: ['0', '2', '4', '6', '8', '10', '12', '14'], pre: ['2', '4', '6', '8'] }] },
        ],
        specs: ['Marca', 'Técnica', 'Composición', 'Medidas'],
    },

    merceria: {
        variantes: [
            { id: 'mer-hilo', nombre: 'Hilos y lanas', opciones: [COLOR, { nombre: 'Peso', valores: ['50 g', '100 g', '200 g', '500 g'], pre: ['100 g'] }] },
            { id: 'mer-tela', nombre: 'Telas', opciones: [COLOR, { nombre: 'Largo', valores: ['0,5 m', '1 m', '1,5 m', '2 m', '3 m', '5 m'], pre: ['1 m', '2 m'] }] },
            { id: 'mer-boton', nombre: 'Botones y avíos', opciones: [{ nombre: 'Medida', valores: ['10 mm', '12 mm', '15 mm', '18 mm', '20 mm', '25 mm'], pre: ['12 mm', '15 mm', '20 mm'] }, COLOR, { nombre: 'Presentación', valores: ['Unidad', 'Blíster x 6', 'Bolsa x 50'], pre: ['Blíster x 6'] }] },
            { id: 'mer-cierre', nombre: 'Cierres', opciones: [{ nombre: 'Largo', valores: ['12 cm', '15 cm', '18 cm', '20 cm', '25 cm', '50 cm', '60 cm'], pre: ['15 cm', '20 cm', '60 cm'] }, COLOR] },
        ],
        specs: ['Composición', 'Ancho de la tela', 'Marca', 'Cuidados'],
    },

    pasteleria: {
        variantes: [
            { id: 'pas-torta', nombre: 'Tortas', opciones: [{ nombre: 'Tamaño', valores: ['8 porciones', '12 porciones', '16 porciones', '20 porciones', '30 porciones'], pre: ['8 porciones', '12 porciones', '20 porciones'] }, { nombre: 'Sabor', valores: ['Chocolate', 'Vainilla', 'Dulce de leche', 'Frutilla', 'Limón', 'Red velvet'], pre: [] }] },
            { id: 'pas-docena', nombre: 'Por unidad o docena', opciones: [{ nombre: 'Presentación', valores: ['Unidad', 'Media docena', 'Docena'] }, { nombre: 'Sabor', valores: ['Chocolate', 'Vainilla', 'Dulce de leche', 'Frutilla', 'Limón'], pre: [] }] },
            { id: 'pas-caja', nombre: 'Cajas y boxes', opciones: [{ nombre: 'Tamaño', valores: ['Chica', 'Mediana', 'Grande'] }] },
        ],
        specs: ['Porciones', 'Ingredientes', 'Apto celíacos', 'Conservación', 'Anticipación del pedido'],
    },

    insumos: {
        variantes: [
            { id: 'ins-presentacion', nombre: 'Por presentación', opciones: [{ nombre: 'Presentación', valores: ['Unidad', 'Pack', 'Caja', 'Bolsa', 'Bidón'], pre: ['Unidad', 'Caja'] }] },
            { id: 'ins-medida', nombre: 'Por medida', opciones: [{ nombre: 'Medida', valores: ['Chica', 'Mediana', 'Grande'] }, { nombre: 'Presentación', valores: ['Unidad', 'Pack x 10', 'Pack x 100'], pre: ['Unidad'] }] },
        ],
        specs: ['Marca', 'Material', 'Medidas', 'Rendimiento'],
    },

    pesca: {
        variantes: [
            { id: 'pes-cana', nombre: 'Cañas', opciones: [{ nombre: 'Largo', valores: ['1,50 m', '1,80 m', '2,10 m', '2,40 m', '2,70 m', '3,00 m', '3,60 m', '4,20 m'], pre: ['1,80 m', '2,10 m', '2,40 m'] }, { nombre: 'Acción', valores: ['Ultra liviana', 'Liviana', 'Media', 'Pesada'], pre: ['Liviana', 'Media'] }, { nombre: 'Tramos', valores: ['1 tramo', '2 tramos', 'Telescópica'], pre: ['2 tramos'] }] },
            { id: 'pes-reel', nombre: 'Reeles', opciones: [{ nombre: 'Tamaño', valores: ['1000', '2000', '2500', '3000', '4000', '5000', '6000'], pre: ['2000', '3000', '4000'] }, { nombre: 'Tipo', valores: ['Frontal', 'Rotativo', 'Huevito'], pre: ['Frontal'] }] },
            { id: 'pes-linea', nombre: 'Líneas y multifilamentos', opciones: [{ nombre: 'Diámetro', valores: ['0,16 mm', '0,20 mm', '0,25 mm', '0,30 mm', '0,35 mm', '0,40 mm', '0,50 mm', '0,60 mm'], pre: ['0,25 mm', '0,30 mm', '0,35 mm', '0,40 mm'] }, { nombre: 'Largo', valores: ['100 m', '150 m', '300 m', '500 m'], pre: ['100 m', '300 m'] }] },
            { id: 'pes-anzuelo', nombre: 'Anzuelos', opciones: [{ nombre: 'Número', valores: ['10', '8', '6', '4', '2', '1', '1/0', '2/0', '3/0', '4/0', '5/0'], pre: ['4', '2', '1', '1/0', '2/0'] }, { nombre: 'Presentación', valores: ['Sobre x 10', 'Sobre x 25', 'Caja x 100'], pre: ['Sobre x 10'] }] },
            { id: 'pes-senuelo', nombre: 'Señuelos', opciones: [{ nombre: 'Color', valores: ['Natural', 'Plateado', 'Dorado', 'Rojo y blanco', 'Firetiger', 'Verde', 'Negro'], pre: [] }, { nombre: 'Peso', valores: ['3 g', '5 g', '7 g', '10 g', '15 g', '20 g', '30 g'], pre: ['7 g', '10 g', '15 g'] }] },
        ],
        specs: ['Marca', 'Material', 'Potencia (lb)', 'Especie objetivo', 'Agua dulce o salada', 'Rulemanes'],
    },

    deportes: {
        variantes: [
            { id: 'dep-ropa', nombre: 'Indumentaria deportiva', opciones: [TALLES_LETRA, COLOR] },
            { id: 'dep-pesas', nombre: 'Pesas y discos', opciones: [{ nombre: 'Peso', valores: ['1 kg', '2 kg', '3 kg', '5 kg', '7,5 kg', '10 kg', '15 kg', '20 kg', '25 kg'], pre: ['2 kg', '5 kg', '10 kg'] }] },
            { id: 'dep-pelota', nombre: 'Pelotas', opciones: [{ nombre: 'Número', valores: ['3', '4', '5'], pre: ['5'] }, COLOR] },
            { id: 'dep-protector', nombre: 'Guantes, protecciones y accesorios', opciones: [{ nombre: 'Talle', valores: ['XS', 'S', 'M', 'L', 'XL'], pre: ['S', 'M', 'L'] }, COLOR] },
        ],
        specs: ['Marca', 'Material', 'Deporte', 'Nivel', 'Garantía'],
    },

    bebes: {
        variantes: [
            { id: 'beb-ropa', nombre: 'Ropa de bebé', opciones: [TALLES_BEBE, COLOR] },
            { id: 'beb-panal', nombre: 'Pañales', opciones: [{ nombre: 'Talle', valores: ['Recién nacido', 'P', 'M', 'G', 'XG', 'XXG'], pre: ['P', 'M', 'G', 'XG'] }, { nombre: 'Unidades', valores: ['x 20', 'x 30', 'x 40', 'x 60', 'x 80'], pre: ['x 40', 'x 60'] }] },
            { id: 'beb-accesorio', nombre: 'Mamaderas y accesorios', opciones: [{ nombre: 'Capacidad', valores: ['125 ml', '150 ml', '250 ml', '330 ml'], pre: ['150 ml', '250 ml'] }, COLOR] },
        ],
        specs: ['Edad recomendada', 'Material', 'Libre de BPA', 'Marca', 'Cuidados'],
    },

    alimentos: {
        variantes: [
            { id: 'ali-peso', nombre: 'Suelto por peso (dietética)', opciones: [{ nombre: 'Peso', valores: ['100 g', '250 g', '500 g', '1 kg', '5 kg'], pre: ['250 g', '500 g', '1 kg'] }] },
            { id: 'ali-bebida', nombre: 'Bebidas', opciones: [{ nombre: 'Contenido', valores: ['350 ml', '473 ml', '500 ml', '750 ml', '1 L', '1,5 L', '2,25 L'], pre: ['500 ml', '1,5 L'] }, { nombre: 'Presentación', valores: ['Unidad', 'Pack x 6', 'Pack x 12'], pre: ['Unidad', 'Pack x 6'] }] },
            { id: 'ali-sabor', nombre: 'Por sabor', opciones: [{ nombre: 'Sabor', valores: ['Original', 'Chocolate', 'Vainilla', 'Frutilla', 'Dulce de leche', 'Limón'], pre: [] }, { nombre: 'Presentación', valores: ['Unidad', 'Pack x 3', 'Caja x 12'], pre: ['Unidad'] }] },
        ],
        specs: ['Marca', 'Ingredientes', 'Sin TACC', 'Vencimiento', 'Conservación', 'Origen'],
    },

    celulares: {
        variantes: [
            {
                id: 'cel-funda', nombre: 'Fundas y vidrios templados',
                opciones: [
                    { nombre: 'Modelo', valores: ['iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 16', 'Samsung A15', 'Samsung A25', 'Samsung A35', 'Samsung A55', 'Motorola G24', 'Motorola G54', 'Xiaomi Redmi 13', 'Xiaomi Redmi Note 13'], pre: [] },
                    COLOR,
                ],
            },
            { id: 'cel-cargador', nombre: 'Cargadores y cables', opciones: [{ nombre: 'Conector', valores: ['USB-C', 'Lightning', 'Micro USB'], pre: ['USB-C', 'Lightning'] }, { nombre: 'Largo', valores: ['1 m', '1,5 m', '2 m'], pre: ['1 m'] }] },
            { id: 'cel-audio', nombre: 'Auriculares y parlantes', opciones: [COLOR] },
        ],
        specs: ['Marca', 'Compatibilidad', 'Potencia', 'Garantía'],
    },

    hogar: {
        variantes: [
            { id: 'hog-blanco', nombre: 'Sábanas, acolchados y toallas', opciones: [MEDIDA_CAMA, COLOR] },
            { id: 'hog-cocina', nombre: 'Ollas, sartenes y bazar', opciones: [{ nombre: 'Diámetro', valores: ['16 cm', '18 cm', '20 cm', '24 cm', '28 cm', '32 cm'], pre: ['20 cm', '24 cm', '28 cm'] }, COLOR] },
            { id: 'hog-deco', nombre: 'Deco por tamaño', opciones: [{ nombre: 'Tamaño', valores: ['Chico', 'Mediano', 'Grande'] }, COLOR] },
            { id: 'hog-cortina', nombre: 'Cortinas y alfombras', opciones: [{ nombre: 'Medida', valores: ['140x200', '160x230', '200x250', '200x300'], pre: ['140x200', '200x250'] }, COLOR] },
        ],
        specs: ['Material', 'Medidas', 'Apto lavavajillas', 'Apto microondas', 'Cuidados'],
    },

    bicicleteria: {
        variantes: [
            { id: 'bic-bici', nombre: 'Bicicletas', opciones: [{ nombre: 'Rodado', valores: ['R12', 'R16', 'R20', 'R24', 'R26', 'R27,5', 'R29'], pre: ['R26', 'R29'] }, { nombre: 'Talle de cuadro', valores: ['XS', 'S', 'M', 'L', 'XL'], pre: ['S', 'M', 'L'] }, COLOR] },
            { id: 'bic-cubierta', nombre: 'Cubiertas y cámaras', opciones: [{ nombre: 'Rodado', valores: ['R16', 'R20', 'R24', 'R26', 'R27,5', 'R29', '700c'], pre: ['R26', 'R29'] }, { nombre: 'Ancho', valores: ['1,75"', '1,95"', '2,10"', '2,25"', '2,35"'], pre: ['1,95"', '2,10"'] }] },
            { id: 'bic-casco', nombre: 'Cascos e indumentaria', opciones: [{ nombre: 'Talle', valores: ['S', 'M', 'L', 'XL'], pre: ['S', 'M', 'L'] }, COLOR] },
        ],
        specs: ['Marca', 'Material del cuadro', 'Velocidades', 'Frenos', 'Suspensión'],
    },
}

// ─── Lo que ve el formulario ─────────────────────────────────────────────────

export interface GrupoPresets { key: string; variantes: PresetVariantes[] }

/**
 * Los modelos a ofrecer para un negocio, agrupados por subrubro y en el orden
 * en que los eligió. Un negocio puede vender varias cosas a la vez
 * (indumentaria + calzado), y un producto es UNA de ellas: por eso se ofrecen
 * separados para elegir, nunca fusionados en un solo producto.
 *
 * Sin ningún subrubro con modelos propios (o solo "De todo un poco"), vuelve
 * los genéricos.
 */
export function presetsDelNegocio(subrubros: string[]): GrupoPresets[] {
    const grupos = subrubros
        .filter(k => PRESETS[k])
        .map(k => ({ key: k, variantes: PRESETS[k].variantes }))
    return grupos.length > 0 ? grupos : [{ key: 'detodo', variantes: GENERICOS.variantes }]
}

/** Especificaciones sugeridas para la ficha técnica: la unión de las de cada
 *  subrubro del negocio, sin repetir y respetando el orden de aparición. */
export function specsDelNegocio(subrubros: string[]): string[] {
    const fuentes = subrubros.map(k => PRESETS[k]?.specs).filter((x): x is string[] => !!x)
    const lista = fuentes.length > 0 ? fuentes.flat() : GENERICOS.specs
    return [...new Set(lista)]
}
