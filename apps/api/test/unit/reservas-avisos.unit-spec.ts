// Los emails de una reserva (reservas-avisos.service.ts): concordancia, la seña
// según la config y el servicio que no se nombra en psicología (Turnos, 25/11).
import { ReservasAvisosService } from '../../src/reservas/reservas-avisos.service';
import { fmtPesos } from '../../src/common/utils/pesos';

const reserva = (over: Record<string, unknown> = {}) => ({
  id: 'r1', businessId: 'b1', modulo: 'TURNOS', clienteEmail: 'ana@ejemplo.invalid', clienteNombre: 'Ana', clienteId: null,
  tokenAcceso: 't'.repeat(32), codigo: 'ABCDEF', inicio: new Date('2026-11-30T13:00:00Z'), fin: new Date('2026-11-30T13:30:00Z'),
  servicio: { nombre: 'Sesión individual' }, precio: 30000, sena: 9000, pagado: 0, canceladaPor: null, motivoCancelacion: null, ...over,
}) as never;

function armar(negocio: Record<string, unknown> = {}, config: Record<string, unknown> | null = { senaReembolsable: true, cancelacionHastaHoras: 24 }) {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', name: 'Consultorio Norte', subdomain: 'norte', industry: 'turnos', subrubros: ['consulta'], ...negocio }) },
    reservaConfig: { findUnique: jest.fn().mockResolvedValue(config) },
  };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(undefined) };
  const svc = new ReservasAvisosService(prisma as never, mail as never);
  const enviado = () => { const [para, asunto, html] = mail.sendCustomEmail.mock.calls[0]; return { para, asunto, html: html as string }; };
  return { svc, mail, enviado };
}

describe('ReservasAvisosService', () => {
  it('Turnos: confirmado, con el servicio, la seña a pagar y cuándo se devuelve', async () => {
    const { svc, enviado } = armar();
    await svc.confirmada(reserva(), 'Dra. Paz');
    const { para, asunto, html } = enviado();
    expect(para).toBe('ana@ejemplo.invalid');
    expect(asunto).toBe('Tu turno en Consultorio Norte está confirmado');
    expect(html).toContain('Sesión individual con Dra. Paz');
    expect(html).toContain('(a pagar: la coordinás con el negocio). Si cancelás hasta 24 horas antes, la seña se devuelve.');
    expect(html).toContain('https://norte.orbita.site/mi-turno/');
  });

  it('psicología: el email no nombra el servicio', async () => {
    const { svc, enviado } = armar({ subrubros: ['psico'] });
    await svc.confirmada(reserva(), 'Lic. Sosa');
    expect(enviado().html).toContain('Turno con Lic. Sosa');
    expect(enviado().html).not.toContain('Sesión individual');
  });

  it('una seña pagada que no se devuelve lo dice así', async () => {
    const { svc, enviado } = armar({}, { senaReembolsable: false, cancelacionHastaHoras: 24 });
    await svc.pendiente(reserva({ pagado: 9000 }), 'Dra. Paz');
    expect(enviado().html).toContain(`Seña: ${fmtPesos(9000)} (pagada). La seña no se devuelve si cancelás.`);
  });

  it('Alquileres: "tu reserva está confirmada" y "fue cancelada"', async () => {
    const a = armar({ industry: 'alquileres', subrubros: [] });
    await a.svc.confirmada(reserva({ modulo: 'ALQUILERES', servicio: null, sena: 0 }), 'Cabaña 1');
    expect(a.enviado().asunto).toBe('Tu reserva en Consultorio Norte está confirmada');
    const b = armar({ industry: 'alquileres', subrubros: [] });
    await b.svc.cancelada(reserva({ modulo: 'ALQUILERES', servicio: null }), 'Cabaña 1', 'SIN_SENA');
    expect(b.enviado().asunto).toBe('Tu reserva en Consultorio Norte fue cancelada');
  });

  it('sin email de la persona no manda nada', async () => {
    const { svc, mail } = armar();
    await svc.confirmada(reserva({ clienteEmail: null }), 'Dra. Paz');
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });
});

