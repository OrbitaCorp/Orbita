import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OrbiChatDto, OrbiSurface } from './orbi-chat.dto';

// Se replica el ValidationPipe global (main.ts): whitelist + transform.
function validar(body: unknown) {
  const dto = plainToInstance(OrbiChatDto, body, { excludeExtraneousValues: false });
  const errores = validateSync(dto as object, { whitelist: true });
  return { dto, errores };
}

describe('OrbiChatDto', () => {
  const base = {
    message: 'hola',
    context: { surface: OrbiSurface.WIZARD, stepName: 'tu-negocio' },
  };

  it('acepta un contexto de wizard con formState', () => {
    const { dto, errores } = validar({
      ...base,
      context: {
        ...base.context,
        formState: { nombre: 'Rama', telefonoCargado: true, subrubros: ['ropa'] },
      },
    });

    expect(errores).toHaveLength(0);
    expect(dto.context.formState?.nombre).toBe('Rama');
  });

  // Todo lo que entra por acá termina interpolado en el SYSTEM prompt, y el
  // endpoint del wizard es público: los topes de largo tienen que aplicarse de
  // verdad. Antes NO se aplicaban — context era @IsObject() a secas, sin
  // ValidateNested, así que class-validator ni bajaba al objeto.
  it('rechaza un formState con un campo más largo que su tope', () => {
    const { errores } = validar({
      ...base,
      context: { ...base.context, formState: { nombre: 'x'.repeat(121) } },
    });

    expect(errores.length).toBeGreaterThan(0);
  });

  it('rechaza un sessionId más largo que su tope', () => {
    const { errores } = validar({
      ...base,
      context: { ...base.context, sessionId: 'x'.repeat(65) },
    });

    expect(errores.length).toBeGreaterThan(0);
  });

  it('rechaza un surface que no existe', () => {
    const { errores } = validar({ ...base, context: { surface: 'admin' } });
    expect(errores.length).toBeGreaterThan(0);
  });

  it('el contexto del panel sigue siendo válido', () => {
    const { errores } = validar({
      message: 'hola',
      context: {
        surface: OrbiSurface.PANEL,
        module: 'catalogo',
        section: 'productos',
        businessId: '3f1e6c9a-1b2d-4e5f-8a90-1234567890ab',
        permissions: ['products:write'],
      },
    });

    expect(errores).toHaveLength(0);
  });
});
