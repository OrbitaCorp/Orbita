import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OnboardingController, registroDirectoHabilitado } from '../../src/onboarding/onboarding.controller';
import { RegisterBusinessDto } from '../../src/onboarding/dto/register-business.dto';

// Auditoría interna 10/09, ítem api.onboarding: el alta directa sin pago
// queda apagada en producción y los nombres del alta tienen tope.

describe('registroDirectoHabilitado', () => {
  it('en desarrollo y en tests está habilitado', () => {
    expect(registroDirectoHabilitado({ NODE_ENV: 'development' })).toBe(true);
    expect(registroDirectoHabilitado({ NODE_ENV: 'test' })).toBe(true);
    expect(registroDirectoHabilitado({})).toBe(true);
  });
  it('en producción está apagado salvo PERMITIR_REGISTRO_DIRECTO=true', () => {
    expect(registroDirectoHabilitado({ NODE_ENV: 'production' })).toBe(false);
    expect(registroDirectoHabilitado({ NODE_ENV: 'production', PERMITIR_REGISTRO_DIRECTO: '1' })).toBe(false);
    expect(registroDirectoHabilitado({ NODE_ENV: 'production', PERMITIR_REGISTRO_DIRECTO: 'true' })).toBe(true);
  });
});

describe('POST /onboarding/register-business', () => {
  const dto = { ownerName: 'Ana', email: 'ana@x.com', password: 'secreta123', businessName: 'Tienda' };
  const envOriginal = { ...process.env };
  afterEach(() => { process.env = { ...envOriginal }; });

  it('en producción responde 404 y no crea nada', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PERMITIR_REGISTRO_DIRECTO;
    const service = { registerBusiness: jest.fn() };
    const controller = new OnboardingController(service as any);
    expect(() => controller.register(dto)).toThrow(NotFoundException);
    expect(service.registerBusiness).not.toHaveBeenCalled();
  });

  it('fuera de producción sigue creando la cuenta', () => {
    process.env.NODE_ENV = 'test';
    const service = { registerBusiness: jest.fn().mockReturnValue('ok') };
    const controller = new OnboardingController(service as any);
    expect(controller.register(dto)).toBe('ok');
  });
});

describe('RegisterBusinessDto', () => {
  const base = { email: 'ana@x.com', password: 'secreta123' };
  const props = async (body: object) => (await validate(plainToInstance(RegisterBusinessDto, body))).map((e) => e.property);

  it('recorta los nombres', async () => {
    const dto = plainToInstance(RegisterBusinessDto, { ...base, ownerName: '  Ana ', businessName: ' Tienda  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.ownerName).toBe('Ana');
    expect(dto.businessName).toBe('Tienda');
  });
  it('rechaza nombres vacíos o de más de 80', async () => {
    expect(await props({ ...base, ownerName: '   ', businessName: 'x'.repeat(81) })).toEqual(['ownerName', 'businessName']);
  });
});
