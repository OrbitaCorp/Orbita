import { VENTANA_AVISO_MIN, VideosAvisoService } from '../../src/marketing/videos/videos-aviso.service';

// El aviso por correo de «hay videos para aprobar»: a quién le llega, cuándo NO se manda (para no llenar la bandeja) y que
// un fallo del correo nunca rompa nada. Base y correo simulados.

type Pendiente = { titulo: string; duracionSeg: number | null; updatedAt: Date; expiraAt: Date | null }
const hace = (min: number) => new Date(Date.now() - min * 60_000)
const pendiente = (titulo: string, minDesdeRegistro = 1): Pendiente => ({ titulo, duracionSeg: 13, updatedAt: hace(minDesdeRegistro), expiraAt: new Date(Date.now() + 6 * 86_400_000) })

function armar(opciones: { pendientes?: Pendiente[]; ultimoAviso?: Date | null; admins?: string[]; env?: Record<string, string> } = {}) {
  const pendientes = opciones.pendientes ?? [pendiente('Reel uno')]
  const admins = (opciones.admins ?? ['ceo@orbita-corp.com', 'milagros@orbita.site', 'vegaalanadrian@gmail.com']).map((email) => ({ email }))
  const prisma = {
    marketingVideo: { findMany: jest.fn(async () => pendientes) },
    platformAdminLog: {
      findFirst: jest.fn(async () => (opciones.ultimoAviso ? { createdAt: opciones.ultimoAviso } : null)),
      create: jest.fn(async () => ({})),
    },
    platformAdmin: { findMany: jest.fn(async () => admins) },
  }
  const mail = { sendCustomEmail: jest.fn(async (_to: string, _asunto: string, _html: string) => true) }
  const env: Record<string, string> = { FRONTEND_URL: 'https://orbita.site', ...(opciones.env ?? {}) }
  const config = { get: (k: string) => env[k] }
  return { svc: new VideosAvisoService(prisma as never, mail as never, config as never), prisma, mail }
}

describe('aviso de videos para aprobar', () => {
  it('manda un correo a cada superadmin activo del equipo (orbita.site y orbita-corp.com) y a nadie más', async () => {
    const { svc, mail } = armar()
    const r = await svc.avisar('admin-1', 'registro')
    expect(r).toEqual({ enviados: 2, pendientes: 1 })
    expect(mail.sendCustomEmail.mock.calls.map((c) => c[0]).sort()).toEqual(['ceo@orbita-corp.com', 'milagros@orbita.site'])
  })

  it('el asunto cuenta los pendientes y el cuerpo lista los títulos, escapados, con el botón al panel', async () => {
    const { svc, mail } = armar({ pendientes: [pendiente('Reel <b>uno</b>'), pendiente('Reel dos')] })
    await svc.avisar('admin-1', 'registro')
    const [, asunto, html] = mail.sendCustomEmail.mock.calls[0]
    expect(asunto).toBe('Hay 2 videos para aprobar en Órbita')
    expect(html).toContain('Reel &lt;b&gt;uno&lt;/b&gt;')
    expect(html).not.toContain('<b>uno</b>')
    expect(html).toContain('href="https://orbita.site/superadmin?seccion=marketing"')
    expect(html).toContain('Nada se publica solo')
  })

  it('con un solo pendiente el asunto va en singular', async () => {
    const { svc, mail } = armar();
    await svc.avisar('admin-1', 'registro')
    expect(mail.sendCustomEmail.mock.calls[0][1]).toBe('Hay 1 video para aprobar en Órbita')
  })

  it('si ya salió un aviso hace menos de 10 minutos, un video nuevo no manda otro correo', async () => {
    const { svc, mail } = armar({ ultimoAviso: hace(VENTANA_AVISO_MIN - 3) })
    expect(await svc.avisar('admin-1', 'registro')).toEqual({ enviados: 0, pendientes: 1 })
    expect(mail.sendCustomEmail).not.toHaveBeenCalled()
  })

  it('pasada la ventana, un video nuevo sí avisa de nuevo (con todos los pendientes)', async () => {
    const { svc, mail } = armar({ ultimoAviso: hace(VENTANA_AVISO_MIN + 5), pendientes: [pendiente('A', 30), pendiente('B', 1)] })
    expect((await svc.avisar('admin-1', 'registro')).enviados).toBe(2)
    expect(mail.sendCustomEmail.mock.calls[0][1]).toBe('Hay 2 videos para aprobar en Órbita')
  })

  it('al terminar la tanda avisa solo si hay un video que entró después del último aviso', async () => {
    const conNovedad = armar({ ultimoAviso: hace(5), pendientes: [pendiente('Primero', 8), pendiente('Segundo', 2)] })
    expect((await conNovedad.svc.avisar('admin-1', 'tanda')).enviados).toBe(2)
    const sinNovedad = armar({ ultimoAviso: hace(2), pendientes: [pendiente('Primero', 8)] })
    expect(await sinNovedad.svc.avisar('admin-1', 'tanda')).toEqual({ enviados: 0, pendientes: 1 })
    expect(sinNovedad.mail.sendCustomEmail).not.toHaveBeenCalled()
  })

  it('sin pendientes, o sin nadie a quien avisar, no manda nada ni anota nada', async () => {
    const vacio = armar({ pendientes: [] })
    expect(await vacio.svc.avisar('admin-1', 'registro')).toEqual({ enviados: 0, pendientes: 0 })
    const sinEquipo = armar({ admins: ['alguien@gmail.com'] })
    expect((await sinEquipo.svc.avisar('admin-1', 'registro')).enviados).toBe(0)
    expect(sinEquipo.prisma.platformAdminLog.create).not.toHaveBeenCalled()
  })

  it('anota el aviso en el registro de acciones y respeta los dominios configurados', async () => {
    const { svc, prisma, mail } = armar({ env: { MCP_DOMINIOS_PERMITIDOS: 'gmail.com' } })
    await svc.avisar('admin-1', 'registro')
    expect(mail.sendCustomEmail.mock.calls.map((c) => c[0])).toEqual(['vegaalanadrian@gmail.com'])
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adminId: 'admin-1', action: 'video_aviso' }) })
  })

  it('si el correo de uno falla, los demás igual salen; y si todo falla no tira', async () => {
    const { svc, mail } = armar()
    mail.sendCustomEmail.mockRejectedValueOnce(new Error('Resend caído'))
    expect((await svc.avisar('admin-1', 'registro')).enviados).toBe(1)
    const roto = armar()
    roto.prisma.marketingVideo.findMany.mockRejectedValueOnce(new Error('base caída'))
    await expect(roto.svc.avisar('admin-1', 'registro')).resolves.toEqual({ enviados: 0, pendientes: 0 })
  })
})
