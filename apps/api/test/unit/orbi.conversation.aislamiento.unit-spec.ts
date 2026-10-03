import { NotFoundException } from '@nestjs/common';
import { ConversationService } from '../../src/orbi/conversation/conversation.service';

// Aislamiento de las conversaciones del panel de Orbi (auditoría interna
// 2026-09-09, verificación 2 del ítem `api.prisma`).
//
// El id de la conversación lo manda el cliente en cada mensaje
// (`dto.conversationId`). Buscarlo solo por id era un IDOR entre negocios:
// con el id de la conversación de otra tienda, Orbi la leía entera y la usaba
// como historial del turno — o sea que se la contaba al que preguntara — y
// además le escribía mensajes adentro. Que los uuid no se adivinen es un
// obstáculo, no un control de acceso.

const CONV = {
  id: 'conv-1',
  businessId: 'biz-1',
  userId: 'member-1',
  surface: 'panel',
  messages: [{ role: 'user', content: 'cuánto vendí este mes', timestamp: '2026-09-09T10:00:00.000Z' }],
};

function servicio() {
  // Simula el filtro real de Prisma: devuelve la fila solo si los tres campos
  // del where coinciden, que es exactamente lo que el bug no hacía.
  const findFirst = jest.fn(({ where }: { where: { id: string; businessId: string; userId: string } }) =>
    Promise.resolve(
      where.id === CONV.id && where.businessId === CONV.businessId && where.userId === CONV.userId ? { ...CONV } : null,
    ),
  );
  // El append es un UPDATE crudo (ver el describe de abajo): los últimos tres
  // valores son id, negocio y persona del WHERE, y devuelve las filas tocadas.
  const $executeRaw = jest.fn((_sql: TemplateStringsArray, ...valores: unknown[]) => {
    const [id, businessId, userId] = valores.slice(-3);
    return Promise.resolve(id === CONV.id && businessId === CONV.businessId && userId === CONV.userId ? 1 : 0);
  });
  const update = jest.fn().mockResolvedValue({ ...CONV });
  const create = jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'conv-nueva', ...data }));
  const prisma = { orbiConversation: { findFirst, update, findUnique: jest.fn(), create }, $executeRaw } as never;
  return { svc: new ConversationService(prisma), findFirst, update, create, $executeRaw };
}

const MENSAJE = { role: 'user' as const, content: 'hola', timestamp: '2026-09-09T11:00:00.000Z' };

describe('Conversaciones de Orbi — son de un negocio y de una persona', () => {
  it('el dueño de la conversación la lee y le escribe', async () => {
    const { svc, $executeRaw } = servicio();
    await expect(svc.historialSiEsPropia('conv-1', 'biz-1', 'member-1')).resolves.toHaveLength(1);
    await expect(svc.appendMessage('conv-1', 'biz-1', 'member-1', MENSAJE)).resolves.toBeUndefined();
    expect($executeRaw).toHaveBeenCalledTimes(1);
  });

  it('otro NEGOCIO no puede leerla ni escribirle', async () => {
    const { svc, update } = servicio();
    await expect(svc.historialSiEsPropia('conv-1', 'biz-2', 'member-1')).resolves.toBeNull();
    await expect(svc.appendMessage('conv-1', 'biz-2', 'member-1', MENSAJE)).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('otra PERSONA del mismo negocio tampoco', async () => {
    const { svc, update } = servicio();
    await expect(svc.historialSiEsPropia('conv-1', 'biz-1', 'member-2')).resolves.toBeNull();
    await expect(svc.appendMessage('conv-1', 'biz-1', 'member-2', MENSAJE)).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('una conversación que no existe se trata igual que una ajena', async () => {
    const { svc } = servicio();
    await expect(svc.historialSiEsPropia('conv-inventada', 'biz-1', 'member-1')).resolves.toBeNull();
    await expect(svc.appendMessage('conv-inventada', 'biz-1', 'member-1', MENSAJE)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el filtro va en la consulta, no después de traer la fila', async () => {
    const { svc, findFirst } = servicio();
    await svc.historialSiEsPropia('conv-1', 'biz-1', 'member-1');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'conv-1', businessId: 'biz-1', userId: 'member-1' } });
  });
});

// Spec §3.3, "Escritura atómica del historial". El append leía el JSON, le
// agregaba el mensaje y lo reescribía entero, sin lock: con dos escritores a la
// vez (el turno del chat y la nota de confirmar o cancelar) uno pisaba al otro
// y se perdía un mensaje. Ahora es un único UPDATE que agrega y recorta en la
// base.
describe('appendMessage — un solo UPDATE atómico', () => {
  // El SQL del spec con los parámetros en su lugar. Prisma arma el statement
  // con el template: acá se juntan los pedazos con `$?` para compararlo sin
  // depender de cómo numera los parámetros.
  const SQL_ESPERADO = [
    'UPDATE orbi_conversations',
    "SET messages = ( SELECT COALESCE(jsonb_agg(m ORDER BY i), '[]'::jsonb)",
    'FROM jsonb_array_elements(messages || $?::jsonb) WITH ORDINALITY AS t(m, i)',
    'WHERE i > jsonb_array_length(messages || $?::jsonb) - 200',
    // last_activity_at: el orden de la lista de sesiones (fase 3).
    '), updated_at = now(), last_activity_at = now()',
    'WHERE id = $? AND business_id = $? AND user_id = $?',
  ].join(' ');

  const normalizar = (partes: TemplateStringsArray) => partes.join('$?').replace(/\s+/g, ' ').trim();

  it('ejecuta el UPDATE del spec con el mensaje serializado y el filtro de dueño', async () => {
    const { svc, $executeRaw, findFirst, update } = servicio();
    await svc.appendMessage('conv-1', 'biz-1', 'member-1', MENSAJE);

    expect($executeRaw).toHaveBeenCalledTimes(1);
    const [partes, ...valores] = $executeRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    expect(normalizar(partes)).toBe(SQL_ESPERADO);
    // El mismo array de un elemento en los dos lugares del spec ($1), y el
    // mensaje como texto JSON: el `::jsonb` lo convierte en la base.
    expect(valores).toEqual([JSON.stringify([MENSAJE]), JSON.stringify([MENSAJE]), 'conv-1', 'biz-1', 'member-1']);
    // Nada de leer-modificar-escribir.
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('si el UPDATE no toca filas (ajena o inexistente) tira el mismo NotFoundException de siempre', async () => {
    const { svc, $executeRaw } = servicio();
    $executeRaw.mockResolvedValueOnce(0);
    const err = await svc.appendMessage('conv-1', 'biz-1', 'member-1', MENSAJE).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Conversación no encontrada');
  });
});

describe('crear', () => {
  it('crea una conversación vacía de ese negocio, esa persona y esa superficie', async () => {
    const { svc, create } = servicio();
    const conv = await svc.crear('biz-1', 'member-1', 'panel');
    expect(create).toHaveBeenCalledWith({ data: { businessId: 'biz-1', userId: 'member-1', surface: 'panel', messages: [], title: null, screen: null } });
    expect(conv.id).toBe('conv-nueva');
  });

  it('con título y pantalla (la lista de sesiones de la fase 3)', async () => {
    const { svc, create } = servicio();
    await svc.crear('biz-1', 'member-1', 'panel', { titulo: '¿Cuánto vendí ayer?', pantalla: 'pedidos' });
    expect(create).toHaveBeenCalledWith({ data: { businessId: 'biz-1', userId: 'member-1', surface: 'panel', messages: [], title: '¿Cuánto vendí ayer?', screen: 'pedidos' } });
  });
});
