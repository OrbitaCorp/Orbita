import { VENTANA_AVISO_MIN, VideosAvisoService } from '../../src/marketing/videos/videos-aviso.service';

// El aviso por correo de «hay videos nuevos»: le llega a TODO el equipo (también al correo personal), invita a ver, opinar y
// mejorar, no repite en una misma tanda y un fallo del correo nunca rompe nada. Base y correo simulados.

type Pendiente = { titulo: string; duracionSeg: number | null; updatedAt: Date; expiraAt: Date | null; creadoPor: string | null }
const hace = (min: number) => new Date(Date.now() - min * 60_000)
const pendiente = (titulo: string, minDesdeRegistro = 1): Pendiente => ({ titulo, duracionSeg: 13, updatedAt: hace(minDesdeRegistro), expiraAt: new Date(Date.now() + 6 * 86_400_000), creadoPor: 'mili' })

const EQUIPO = [
  { email: 'ceo@orbita-corp.com', personalEmail: 'mateo.personal@gmail.com' },
  { email: 'cto@orbita-corp.com', personalEmail: null },
  { email: 'milagros@orbita.site', personalEmail: null },
  { email: 'alguien@gmail.com', personalEmail: 'otro@gmail.com' }, // no es del equipo (dominio ajeno)
]

function armar(opciones: { pendientes?: Pendiente[]; ultimoAviso?: Date | null; admins?: { email: string; personalEmail: string | null }[]; env?: Record<string, string> } = {}) {
  const pendientes = opciones.pendientes ?? [pendiente('Reel uno')]
  const prisma = {
    marketingVideo: { findMany: jest.fn(async (_args: unknown) => pendientes) },
    platformAdminLog: {
      findFirst: jest.fn(async (_args: unknown) => (opciones.ultimoAviso ? { createdAt: opciones.ultimoAviso } : null)),
      create: jest.fn(async (_args: unknown) => ({})),
    },
    platformAdmin: { findMany: jest.fn(async () => opciones.admins ?? EQUIPO) },
  }
  const mail = { sendCustomEmail: jest.fn(async (_to: string, _asunto: string, _html: string) => true) }
  const env: Record<string, string> = { FRONTEND_URL: 'https://orbita.site', ...(opciones.env ?? {}) }
  return { svc: new VideosAvisoService(prisma as never, mail as never, { get: (k: string) => env[k] } as never), prisma, mail }
}

describe('aviso de videos nuevos', () => {
  it('le llega a todo el equipo (dominios orbita.site y orbita-corp.com), también a su correo personal, y a nadie más', async () => {
    const { svc, mail } = armar()
    const r = await svc.avisar('admin-1', 'registro')
    expect(r).toEqual({ enviados: 4, pendientes: 1 })
    expect(mail.sendCustomEmail.mock.calls.map((c) => c[0]).sort()).toEqual(['ceo@orbita-corp.com', 'cto@orbita-corp.com', 'mateo.personal@gmail.com', 'milagros@orbita.site'])
  })

  it('el asunto cuenta los pendientes y el cuerpo invita a ver, opinar y mejorar, con los títulos escapados y el botón al panel', async () => {
    const { svc, mail } = armar({ pendientes: [pendiente('Reel <b>uno</b>'), pendiente('Reel dos')] })
    await svc.avisar('admin-1', 'registro')
    const [, asunto, html] = mail.sendCustomEmail.mock.calls[0]
    expect(asunto).toBe('Hay 2 videos nuevos para ver y comentar en Órbita')
    expect(html).toContain('Reel &lt;b&gt;uno&lt;/b&gt;')
    expect(html).not.toContain('<b>uno</b>')
    expect(html).toContain('href="https://orbita.site/superadmin?seccion=marketing"')
    expect(html).toContain('dejá tu opinión')
    expect(html).toContain('Nada se publica solo')
  })

  it('no explica quién aprueba ni cómo: ese dato es interno', async () => {
    const { svc, mail } = armar()
    await svc.avisar('admin-1', 'registro')
    expect(mail.sendCustomEmail.mock.calls[0][2]).not.toMatch(/aprob|CEO|socio|dirección/i)
  })

  it('con un solo pendiente el asunto va en singular; los tutoriales tienen su propio texto', async () => {
    const uno = armar()
    await uno.svc.avisar('admin-1', 'registro')
    expect(uno.mail.sendCustomEmail.mock.calls[0][1]).toBe('Hay 1 video nuevo para ver y comentar en Órbita')
    const tuto = armar({ pendientes: [pendiente('Cargar un producto'), pendiente('Atender un pedido')] })
    await tuto.svc.avisar('admin-1', 'registro', 'TUTORIAL')
    expect(tuto.mail.sendCustomEmail.mock.calls[0][1]).toBe('Hay 2 tutoriales nuevos para ver y comentar en Órbita')
    expect(tuto.mail.sendCustomEmail.mock.calls[0][2]).toContain('Marketing → Videos → Tutoriales')
    expect(tuto.prisma.marketingVideo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { estado: 'PENDIENTE', tipo: 'TUTORIAL' } }))
  })

  it('la ventana de 10 minutos es por tipo: un aviso de marketing reciente no frena el de tutoriales', async () => {
    const { svc, mail, prisma } = armar({ ultimoAviso: hace(VENTANA_AVISO_MIN - 3) })
    expect(await svc.avisar('admin-1', 'registro')).toEqual({ enviados: 0, pendientes: 1 })
    expect(mail.sendCustomEmail).not.toHaveBeenCalled()
    expect(prisma.platformAdminLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { action: 'video_aviso', details: { path: ['tipo'], equals: 'MARKETING' } } }))
    await svc.avisar('admin-1', 'registro', 'TUTORIAL')
    expect(prisma.platformAdminLog.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { action: 'video_aviso', details: { path: ['tipo'], equals: 'TUTORIAL' } } }))
  })

  it('pasada la ventana, un video nuevo sí avisa de nuevo (con todos los pendientes)', async () => {
    const { svc, mail } = armar({ ultimoAviso: hace(VENTANA_AVISO_MIN + 5), pendientes: [pendiente('A', 30), pendiente('B', 1)] })
    expect((await svc.avisar('admin-1', 'registro')).enviados).toBe(4)
    expect(mail.sendCustomEmail.mock.calls[0][1]).toBe('Hay 2 videos nuevos para ver y comentar en Órbita')
  })

  it('al terminar la tanda avisa solo si hay un video que entró después del último aviso', async () => {
    const conNovedad = armar({ ultimoAviso: hace(5), pendientes: [pendiente('Primero', 8), pendiente('Segundo', 2)] })
    expect((await conNovedad.svc.avisar('admin-1', 'tanda')).enviados).toBe(4)
    const sinNovedad = armar({ ultimoAviso: hace(2), pendientes: [pendiente('Primero', 8)] })
    expect(await sinNovedad.svc.avisar('admin-1', 'tanda')).toEqual({ enviados: 0, pendientes: 1 })
    expect(sinNovedad.mail.sendCustomEmail).not.toHaveBeenCalled()
  })

  it('sin pendientes, o sin nadie del equipo a quien avisar, no manda nada ni anota nada', async () => {
    const vacio = armar({ pendientes: [] })
    expect(await vacio.svc.avisar('admin-1', 'registro')).toEqual({ enviados: 0, pendientes: 0 })
    const sinEquipo = armar({ admins: [{ email: 'alguien@gmail.com', personalEmail: null }] })
    expect((await sinEquipo.svc.avisar('admin-1', 'registro')).enviados).toBe(0)
    expect(sinEquipo.prisma.platformAdminLog.create).not.toHaveBeenCalled()
  })

  it('anota el aviso (con su tipo) en el registro de acciones y respeta los dominios configurados', async () => {
    const { svc, prisma, mail } = armar({ env: { MCP_DOMINIOS_PERMITIDOS: 'gmail.com' } })
    await svc.avisar('admin-1', 'registro')
    expect(mail.sendCustomEmail.mock.calls.map((c) => c[0]).sort()).toEqual(['alguien@gmail.com', 'otro@gmail.com'])
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adminId: 'admin-1', action: 'video_aviso', details: expect.objectContaining({ tipo: 'MARKETING' }) }) })
  })

  it('si el correo de uno falla, los demás igual salen; y si todo falla no tira', async () => {
    const { svc, mail } = armar()
    mail.sendCustomEmail.mockRejectedValueOnce(new Error('Resend caído'))
    expect((await svc.avisar('admin-1', 'registro')).enviados).toBe(3)
    const roto = armar()
    roto.prisma.marketingVideo.findMany.mockRejectedValueOnce(new Error('base caída'))
    await expect(roto.svc.avisar('admin-1', 'registro')).resolves.toEqual({ enviados: 0, pendientes: 0 })
  })
})
