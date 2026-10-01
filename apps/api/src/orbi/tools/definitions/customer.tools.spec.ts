import { GetCustomerDetailTool } from './customer.tools';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { ToolExecutionContext } from '../tool.interface';

const ctx: ToolExecutionContext = {
  businessId: 'biz-1',
  userId: 'user-1',
  surface: OrbiSurface.PANEL,
  permissions: ['customers.view'],
};

// Lo que devuelve CustomersService.findOne: todo el detalle del panel.
const clienteCompleto = {
  id: 'c-1',
  firstName: 'Lucía',
  lastName: 'Pérez',
  email: 'lucia.perez@ejemplo.com',
  phone: '+54 9 11 5555-1234',
  dni: '30111222',
  hasAccount: true,
  orderCount: 3,
  totalSpent: 45000,
  avgTicket: 15000,
  lastOrderAt: new Date('2026-09-20T12:00:00Z'),
  createdAt: new Date('2026-01-10T12:00:00Z'),
  orders: [
    {
      id: 'o-1', orderNumber: 101, channel: 'ONLINE', status: 'COMPLETED', total: 20000, itemCount: 2,
      tracking: 'TRACK-SECRETO-1',
      items: [{ productName: 'Remera', variantLabel: 'M', quantity: 2 }],
      createdAt: new Date('2026-09-20T12:00:00Z'),
    },
  ],
  addresses: [
    { id: 'a-1', alias: 'Casa', street: 'Calle Falsa 123', floor: '4B', city: 'Rosario', zip: '2000', isDefault: true },
  ],
  emails: [
    { id: 'e-1', subject: 'Asunto privado del mail', template: null, status: 'SENT', createdAt: new Date() },
  ],
};

describe('GetCustomerDetailTool', () => {
  it('pide customers.view', () => {
    expect(new GetCustomerDetailTool({} as any).requiredPermissions).toEqual(['customers.view']);
  });

  it('no devuelve DNI, email, teléfono, direcciones ni asuntos de mails', async () => {
    const service = { findOne: jest.fn().mockResolvedValue(clienteCompleto) };
    const result = await new GetCustomerDetailTool(service as any).execute({ customerId: 'c-1' }, ctx);

    expect(result.success).toBe(true);
    expect(service.findOne).toHaveBeenCalledWith('biz-1', 'c-1');

    const json = JSON.stringify(result);
    for (const dato of [
      '30111222', 'lucia.perez@ejemplo.com', '+54 9 11 5555-1234',
      'Calle Falsa', 'Asunto privado del mail', 'TRACK-SECRETO-1',
    ]) {
      expect({ dato, filtrado: json.includes(dato) }).toEqual({ dato, filtrado: false });
    }
    const data = result.data as Record<string, unknown>;
    for (const campo of ['dni', 'email', 'phone', 'addresses', 'emails']) {
      expect(data).not.toHaveProperty(campo);
    }
  });

  it('devuelve nombre, métricas, pedidos resumidos y localidad', async () => {
    const service = { findOne: jest.fn().mockResolvedValue(clienteCompleto) };
    const result = await new GetCustomerDetailTool(service as any).execute({ customerId: 'c-1' }, ctx);
    const data = result.data as any;

    expect(data.nombre).toBe('Lucía Pérez');
    expect(data.cantidadPedidos).toBe(3);
    expect(data.totalGastado).toBe(45000);
    expect(data.ticketPromedio).toBe(15000);
    expect(data.pedidos).toEqual([
      expect.objectContaining({ orderNumber: 101, status: 'COMPLETED', total: 20000 }),
    ]);
    // De las direcciones solo la localidad, sin calle ni piso ni código postal.
    expect(data.localidades).toEqual(['Rosario']);
  });
});
