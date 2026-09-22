import type { SupportCategory, SupportMessageAuthor, SupportRequestSource, SupportRequestStatus } from '@prisma/client';

// Lo que viaja en JSON entre la API y los dos clientes (panel del negocio y
// superadmin). Mismos nombres en apps/web/src/lib/api.ts y
// apps/web/src/lib/platform/api.ts: si cambia uno, cambian los tres.

export type SupportAttachment = { url: string; name: string; size?: number; type?: string };

export type SupportMessageDto = {
  id: string;
  author: SupportMessageAuthor;
  authorName: string;
  // Cargo del admin que firma (CEO, CTO...). Null para MEMBER o sin cargo.
  authorTitle: string | null;
  body: string;
  attachments: SupportAttachment[];
  createdAt: string;
};

export type SupportRequestRow = {
  id: string;
  number: number;
  category: SupportCategory;
  subject: string;
  status: SupportRequestStatus;
  createdAt: string;
  lastMessageAt: string;
  messagesCount: number;
  member: { id: string; name: string };
  lastMessage: { author: SupportMessageAuthor; excerpt: string; createdAt: string } | null;
};

export type SupportRequestDetail = SupportRequestRow & {
  contactPhone: string | null;
  messages: SupportMessageDto[];
};

// Lo que el superadmin ve de más respecto del panel. Desde el 22/09 las
// consultas también entran por el formulario público de la landing, sin
// sesión: ahí no hay member, y business solo si el email coincide con un
// miembro de algún negocio.
type AdminSupportExtra = {
  // PANEL: Configuración → Soporte con sesión. LANDING: orbita.site, sin sesión.
  source: SupportRequestSource;
  // Si el email de quien escribe tiene cuenta de miembro en algún negocio
  // (PANEL siempre; LANDING se verifica al crear). Filtro "Con cuenta /
  // Sin cuenta" del superadmin.
  hasAccount: boolean;
  // Null en LANDING sin cuenta. En LANDING con cuenta es el negocio del
  // miembro con ese email, sin que nadie haya probado ser él.
  business: { id: string; name: string; subdomain: string } | null;
  // Quién escribió, venga de donde venga. memberId null en LANDING.
  contact: { name: string; email: string; memberId: string | null };
};

export type AdminSupportRow = Omit<SupportRequestRow, 'member'> & AdminSupportExtra;

export type AdminSupportDetail = Omit<SupportRequestDetail, 'member'> & AdminSupportExtra;

export type SupportSummary = {
  open: number;
  answered: number;
  closed: number;
  manual: {
    chapterId: string;
    helpful: number;
    notHelpful: number;
    comments: { businessName: string; comment: string; helpful: boolean; createdAt: string }[];
  }[];
};
