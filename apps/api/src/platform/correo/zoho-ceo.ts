import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

export type CredencialesZohoCeo = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountId: string;
  email?: string;
};

export type CorreoRecibidoItem = {
  messageId: string;
  folderId: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  summary: string;
  receivedAt: string;
  unread: boolean;
};

export const CORREOS_CUENTA_CEO = new Set([
  'ceo@orbita-corp.com',
  'ceo@orbita.site',
  'mateo@orbita.site',
  'mateo@orbita-corp.com',
]);

export function esEmailDeCeo(email: string | null | undefined): boolean {
  return !!email && CORREOS_CUENTA_CEO.has(email.trim().toLowerCase());
}

export function decodificarEntidades(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .trim();
}

function leerCredenciales(): CredencialesZohoCeo {
  const raw = process.env.ZOHO_CEO_MAIL;
  if (!raw) {
    throw new ServiceUnavailableException('La bandeja de Zoho Mail del CEO no está configurada en este entorno');
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CredencialesZohoCeo>;
    if (!parsed.clientId || !parsed.clientSecret || !parsed.refreshToken || !parsed.accountId) {
      throw new Error('Faltan campos en ZOHO_CEO_MAIL');
    }
    return parsed as CredencialesZohoCeo;
  } catch {
    throw new ServiceUnavailableException('La configuración de Zoho Mail del CEO es inválida');
  }
}

let tokenCache: { token: string; vence: number } | null = null;

async function obtenerAccessToken(creds: CredencialesZohoCeo): Promise<string> {
  const ahora = Date.now();
  if (tokenCache && tokenCache.vence > ahora) {
    return tokenCache.token;
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
  });
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!res.ok || !data?.access_token) {
    throw new ServiceUnavailableException('No se pudo autenticar con Zoho Mail');
  }
  // El access_token de Zoho dura 60 min; se guarda por 50 min.
  tokenCache = { token: data.access_token, vence: ahora + 50 * 60 * 1000 };
  return data.access_token;
}

type ZohoMensajeRaw = {
  messageId?: string | number;
  folderId?: string | number;
  fromAddress?: string;
  sender?: string;
  toAddress?: string;
  subject?: string;
  summary?: string;
  receivedTime?: string | number;
  status?: string | number;
};

export async function listarRecibidosZoho(): Promise<CorreoRecibidoItem[]> {
  const creds = leerCredenciales();
  const token = await obtenerAccessToken(creds);
  const url = `https://mail.zoho.com/api/accounts/${encodeURIComponent(creds.accountId)}/messages/view?limit=50&includeto=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (!res.ok) {
    throw new ServiceUnavailableException('No se pudieron consultar los correos recibidos en Zoho Mail');
  }
  const json = (await res.json().catch(() => null)) as { data?: ZohoMensajeRaw[] } | null;
  const lista = Array.isArray(json?.data) ? json.data : [];

  return lista
    .map((m): CorreoRecibidoItem => {
      const fromEmail = decodificarEntidades(m.fromAddress).replace(/^.*<([^>]+)>.*$/, '$1').trim();
      const fromName = decodificarEntidades(m.sender) || fromEmail;
      const to = decodificarEntidades(m.toAddress).replace(/[<>]/g, '').trim();
      const subject = decodificarEntidades(m.subject) || '(Sin asunto)';
      const summary = decodificarEntidades(m.summary);
      const ts = Number(m.receivedTime);
      return {
        messageId: String(m.messageId ?? ''),
        folderId: String(m.folderId ?? ''),
        fromEmail,
        fromName,
        to,
        subject,
        summary,
        receivedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : new Date().toISOString(),
        unread: String(m.status ?? '') === '0',
      };
    })
    .filter((m) => m.messageId && m.folderId);
}

export async function obtenerContenidoRecibidoZoho(folderId: string, messageId: string): Promise<{ html: string }> {
  if (!/^\d+$/.test(folderId) || !/^\d+$/.test(messageId)) {
    throw new BadRequestException('Identificador de mensaje inválido');
  }
  const creds = leerCredenciales();
  const token = await obtenerAccessToken(creds);
  const url = `https://mail.zoho.com/api/accounts/${encodeURIComponent(creds.accountId)}/folders/${folderId}/messages/${messageId}/content`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (!res.ok) {
    throw new ServiceUnavailableException('No se pudo leer el contenido del correo en Zoho Mail');
  }
  const json = (await res.json().catch(() => null)) as { data?: { content?: string } } | null;
  return { html: String(json?.data?.content ?? '') };
}
