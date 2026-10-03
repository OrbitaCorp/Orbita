import { ACCION_LOG_ADMIN, PlatformAdminLogService } from './platform-admin-log.service';

function armar(create = jest.fn().mockResolvedValue({})) {
  const prisma = { platformAdminLog: { create } };
  return { svc: new PlatformAdminLogService(prisma as never), create };
}

describe('PlatformAdminLogService — Orbi', () => {
  it('orbiCupoAjuste registra el ajuste contra el negocio, con mes, créditos, motivo y id del ajuste', async () => {
    const { svc, create } = armar();
    await svc.orbiCupoAjuste({ adminId: 'ad1', businessId: 'n1', mes: '2026-10', creditos: -200, motivo: 'Uso de prueba', ajusteId: 'aj1' });
    expect(ACCION_LOG_ADMIN.orbiCupoAjuste).toBe('orbi_cupo_ajuste');
    expect(create).toHaveBeenCalledWith({
      data: {
        adminId: 'ad1',
        action: 'orbi_cupo_ajuste',
        targetType: 'business',
        targetId: 'n1',
        details: { mes: '2026-10', creditos: -200, motivo: 'Uso de prueba', ajusteId: 'aj1' },
      },
    });
  });

  it('orbiConversacionAbierta registra la conversación con motivo y ticket, y no lleva el texto', async () => {
    const { svc, create } = armar();
    await svc.orbiConversacionAbierta({ adminId: 'ad1', conversationId: 'c1', motivo: 'Reclamo del dueño', ticket: 'SOP-12' });
    expect(ACCION_LOG_ADMIN.orbiConversacionAbierta).toBe('orbi_conversacion_abierta');
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ adminId: 'ad1', action: 'orbi_conversacion_abierta', targetType: 'orbi_conversation', targetId: 'c1' });
    expect(data.details).toEqual({ motivo: 'Reclamo del dueño', ticket: 'SOP-12' });
  });

  it('un ticket vacío se omite del detalle', async () => {
    const { svc, create } = armar();
    await svc.orbiConversacionAbierta({ adminId: 'ad1', conversationId: 'c1', motivo: 'Reclamo', ticket: '' });
    expect(create.mock.calls[0][0].data.details).toEqual({ motivo: 'Reclamo' });
  });

  it('si falla la escritura no rompe la acción que registra', async () => {
    const { svc } = armar(jest.fn().mockRejectedValue(new Error('conexión caída')));
    await expect(svc.orbiCupoAjuste({ adminId: 'ad1', businessId: 'n1', mes: '2026-10', creditos: 5, motivo: 'abc de', ajusteId: 'a' })).resolves.toBeUndefined();
  });
});
