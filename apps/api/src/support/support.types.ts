import type { SupportCategory, SupportMessageAuthor, SupportRequestStatus } from '@prisma/client';

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

export type AdminSupportRow = SupportRequestRow & {
  business: { id: string; name: string; subdomain: string };
  member: { id: string; name: string; email: string };
};

export type AdminSupportDetail = SupportRequestDetail & {
  business: { id: string; name: string; subdomain: string };
  member: { id: string; name: string; email: string };
};

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
