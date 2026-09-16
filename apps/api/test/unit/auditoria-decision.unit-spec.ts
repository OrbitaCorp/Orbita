import { PlatformAuditService } from '../../src/platform/audit/platform-audit.service';

// Pantalla "Qué hacemos con esto" (super admin → Auditoría → Decisiones).
//
// Lo que se guarda no es un campo suelto: una decisión sin autor ni fecha no
// sirve para nada, porque leyendo el tablero después no se sabe si opinó Mateo
// o Ale. Y volver a "sin decidir" tiene que limpiar los tres campos, si no
// queda una nota huérfana justificando una decisión que ya no existe.

const ADMIN = 'admin-1';
const ITEM = 'item-1';

function armar(actual: Record<string, unknown> = {}) {
  const item = { id: ITEM, key: 'decision.rotar-postgres', titulo: 'Rotar Postgres', estado: 'PENDIENTE', checks: [], ...actual };
  const prisma = {
    platformAuditItem: { findUnique: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue(item) },
    platformAdmin: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
  };
  const svc = new PlatformAuditService(prisma as never);
  // `data` de la llamada real a update, que es lo que se quiere verificar.
  const data = async (dto: Record<string, unknown>) => {
    await svc.actualizar(ADMIN, ITEM, dto as never);
    return prisma.platformAuditItem.update.mock.calls[0][0].data;
  };
  return { svc, prisma, data };
}

describe('Auditoría — decisión de qué hacer con un ítem', () => {
  it('elegir una decisión guarda quién la tomó y cuándo', async () => {
    const { data } = armar();
    const d = await data({ decision: 'HACER' });
    expect(d.decision).toBe('HACER');
    expect(d.decisionPor).toEqual({ connect: { id: ADMIN } });
    expect(d.decisionAt).toBeInstanceOf(Date);
  });

  it('volver a "sin decidir" limpia también el autor, la fecha y la nota', async () => {
    const { data } = armar({ decision: 'NO_HACER', decisionNota: 'no va', decisionPorId: 'otro' });
    const d = await data({ decision: null });
    expect(d.decision).toBeNull();
    expect(d.decisionPor).toEqual({ disconnect: true });
    expect(d.decisionAt).toBeNull();
    expect(d.decisionNota).toBeNull();
  });

  it('una nota mandada junto con decision: null no revive la nota', async () => {
    const { data } = armar({ decision: 'HACER', decisionNota: 'vieja' });
    const d = await data({ decision: null, decisionNota: 'algo que no debería quedar' });
    expect(d.decisionNota).toBeNull();
  });

  it('se puede editar la nota sin volver a elegir la decisión', async () => {
    const { data } = armar({ decision: 'HABLAR' });
    const d = await data({ decisionNota: '  lo vemos el lunes  ' });
    expect(d.decisionNota).toBe('lo vemos el lunes');
    expect(d.decision).toBeUndefined(); // no se toca la decisión ya elegida
    expect(d.decisionAt).toBeUndefined();
  });

  it('una nota vacía se guarda como null, no como cadena vacía', async () => {
    const { data } = armar({ decision: 'HACER' });
    expect((await data({ decisionNota: '   ' })).decisionNota).toBeNull();
  });

  it('actualizar otra cosa no toca la decisión ya tomada', async () => {
    const { data } = armar({ decision: 'HACER', decisionNota: 'dale' });
    const d = await data({ estado: 'EN_CURSO' });
    expect(d).not.toHaveProperty('decision');
    expect(d).not.toHaveProperty('decisionNota');
    expect(d).not.toHaveProperty('decisionAt');
  });

  it('la decisión queda registrada en el log de admins', async () => {
    const { prisma, svc } = armar();
    await svc.actualizar(ADMIN, ITEM, { decision: 'NO_HACER' } as never);
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ adminId: ADMIN, action: 'audit_item_update', details: expect.objectContaining({ decision: 'NO_HACER' }) }) }),
    );
  });
});
