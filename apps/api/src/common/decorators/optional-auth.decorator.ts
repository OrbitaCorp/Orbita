import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

// Distinto de @Public(): ese salta el AuthGuard por completo (nunca toca el
// header, `request.user` queda sin setear pase lo que pase — ni un Bearer
// token válido se procesa). @OptionalAuth() en cambio SÍ intenta resolver la
// sesión si viene un token, y solo si es válido deja `request.user` poblado
// — pero nunca rechaza la request por no tener token, ni por uno inválido o
// vencido (en ese caso simplemente sigue como anónimo). Pensado para
// endpoints que funcionan distinto con y sin sesión (guest checkout: un
// cliente logueado sigue viendo exactamente el mismo comportamiento de
// siempre, un invitado no).
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
