import { ReglasCobro, calcularCobro } from '../../src/appointments/panel/lib/cobro';

// Precio, descuento y seña de un turno (CONTRATO.md § 1.3): siempre en el servidor.

const reglas = (r: Partial<ReglasCobro> = {}): ReglasCobro => ({
  depositEnabled: false, depositForNoShows: true, depositType: 'percent', depositPercent: 30, depositFixed: 5000,
  accountEnabled: true, welcomeDiscountPercent: 0, onlineCharge: 'deposit', ...r,
});
const perfil = (p: Partial<{ noShowCount: number; depositCredit: number; welcomeUsedAt: Date | null }> = {}) => ({ noShowCount: 0, depositCredit: 0, welcomeUsedAt: null, ...p });

describe('calcularCobro — precio', () => {
  it('sin ajuste ni descuentos: el precio de lista, sin seña', () => {
    expect(calcularCobro({ precioServicio: 12000, reglas: reglas(), perfil: null, conCuenta: false })).toEqual({
      precio: 12000, adjustPercent: 0, descuento: 0, usaBienvenida: false, cubierto: 0, aPagar: 12000, sena: 0, creditoUsado: 0, cobroOnline: 0,
    });
  });

  it('"Precios por horario": redondear(price * (100 + adj) / 100)', () => {
    expect(calcularCobro({ precioServicio: 12345, ajustePercent: -15, reglas: reglas(), perfil: null, conCuenta: false })).toMatchObject({ precio: 10493, adjustPercent: -15 });
    expect(calcularCobro({ precioServicio: 1000, ajustePercent: 25, reglas: reglas(), perfil: null, conCuenta: false }).precio).toBe(1250);
  });

  it('el precio a mano del panel reemplaza al de lista y anula el ajuste', () => {
    expect(calcularCobro({ precioServicio: 12000, ajustePercent: 20, precioManual: 9999.99, reglas: reglas(), perfil: null, conCuenta: false })).toMatchObject({ precio: 9999.99, adjustPercent: 0 });
  });
});

describe('calcularCobro — descuento de bienvenida', () => {
  const r = reglas({ welcomeDiscountPercent: 10 });
  it('con cuenta y sin haberlo usado: round(precio * % / 100)', () => {
    expect(calcularCobro({ precioServicio: 12345, reglas: r, perfil: perfil(), conCuenta: true })).toMatchObject({ descuento: 1235, usaBienvenida: true, aPagar: 11110 });
    // Sin ficha todavía también corre: nunca la usó.
    expect(calcularCobro({ precioServicio: 1000, reglas: r, perfil: null, conCuenta: true })).toMatchObject({ descuento: 100, usaBienvenida: true });
  });

  it('no aplica sin cuenta, ya usado, con las cuentas apagadas o en 0 %', () => {
    expect(calcularCobro({ precioServicio: 1000, reglas: r, perfil: perfil(), conCuenta: false }).descuento).toBe(0);
    expect(calcularCobro({ precioServicio: 1000, reglas: r, perfil: perfil({ welcomeUsedAt: new Date() }), conCuenta: true }).descuento).toBe(0);
    expect(calcularCobro({ precioServicio: 1000, reglas: reglas({ welcomeDiscountPercent: 10, accountEnabled: false }), perfil: perfil(), conCuenta: true }).descuento).toBe(0);
    expect(calcularCobro({ precioServicio: 1000, reglas: reglas(), perfil: perfil(), conCuenta: true }).usaBienvenida).toBe(false);
  });

  it('no se acumula con un cupón: gana el mayor (y la bienvenida no se marca si gana el cupón)', () => {
    expect(calcularCobro({ precioServicio: 1000, reglas: r, perfil: perfil(), conCuenta: true, descuentoCupon: 300 })).toMatchObject({ descuento: 300, usaBienvenida: false });
    expect(calcularCobro({ precioServicio: 1000, reglas: r, perfil: perfil(), conCuenta: true, descuentoCupon: 50 })).toMatchObject({ descuento: 100, usaBienvenida: true });
  });
});

describe('calcularCobro — seña', () => {
  it('porcentaje sobre lo que hay que pagar', () => {
    expect(calcularCobro({ precioServicio: 12345, reglas: reglas({ depositEnabled: true }), perfil: null, conCuenta: false })).toMatchObject({ sena: 3704, cobroOnline: 3704 });
  });

  it('fija: nunca más que lo que hay que pagar', () => {
    expect(calcularCobro({ precioServicio: 12000, reglas: reglas({ depositEnabled: true, depositType: 'fixed', depositFixed: 5000 }), perfil: null, conCuenta: false }).sena).toBe(5000);
    expect(calcularCobro({ precioServicio: 3000, reglas: reglas({ depositEnabled: true, depositType: 'fixed', depositFixed: 5000 }), perfil: null, conCuenta: false }).sena).toBe(3000);
  });

  it('quien faltó sin avisar paga seña aunque el negocio no la pida (depositForNoShows)', () => {
    expect(calcularCobro({ precioServicio: 10000, reglas: reglas(), perfil: perfil({ noShowCount: 1 }), conCuenta: false }).sena).toBe(3000);
    expect(calcularCobro({ precioServicio: 10000, reglas: reglas({ depositForNoShows: false }), perfil: perfil({ noShowCount: 1 }), conCuenta: false }).sena).toBe(0);
  });

  it('un servicio gratis no pide seña', () => {
    expect(calcularCobro({ precioServicio: 0, reglas: reglas({ depositEnabled: true }), perfil: null, conCuenta: false }).sena).toBe(0);
  });

  it('el crédito a favor se descuenta de la seña (y se consume solo lo necesario)', () => {
    expect(calcularCobro({ precioServicio: 10000, reglas: reglas({ depositEnabled: true }), perfil: perfil({ depositCredit: 1000 }), conCuenta: false })).toMatchObject({ sena: 2000, creditoUsado: 1000 });
    expect(calcularCobro({ precioServicio: 10000, reglas: reglas({ depositEnabled: true }), perfil: perfil({ depositCredit: 9000 }), conCuenta: false })).toMatchObject({ sena: 0, creditoUsado: 3000 });
  });

  it('con algo cubierto por pack / gift card / membresía no hay seña', () => {
    expect(calcularCobro({ precioServicio: 10000, reglas: reglas({ depositEnabled: true }), perfil: null, conCuenta: false, cubierto: 4000 })).toMatchObject({ cubierto: 4000, aPagar: 6000, sena: 0 });
    expect(calcularCobro({ precioServicio: 10000, reglas: reglas({ depositEnabled: true }), perfil: null, conCuenta: false, cubierto: 99999 })).toMatchObject({ cubierto: 10000, aPagar: 0, sena: 0 });
  });
});

describe('calcularCobro — cobro online', () => {
  const base = { precioServicio: 10000, perfil: null, conCuenta: false };
  it('deposit → la seña; total → lo que hay que pagar; customer_choice → lo que elija', () => {
    expect(calcularCobro({ ...base, reglas: reglas({ depositEnabled: true }) }).cobroOnline).toBe(3000);
    expect(calcularCobro({ ...base, reglas: reglas({ onlineCharge: 'total' }) }).cobroOnline).toBe(10000);
    expect(calcularCobro({ ...base, reglas: reglas({ depositEnabled: true, onlineCharge: 'customer_choice' }), pay: 'total' }).cobroOnline).toBe(10000);
    expect(calcularCobro({ ...base, reglas: reglas({ depositEnabled: true, onlineCharge: 'customer_choice' }), pay: 'deposit' }).cobroOnline).toBe(3000);
    expect(calcularCobro({ ...base, reglas: reglas({ depositEnabled: true, onlineCharge: 'customer_choice' }) }).cobroOnline).toBe(3000);
  });
});
