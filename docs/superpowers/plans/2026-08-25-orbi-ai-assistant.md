# ORBI AI Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ORBI, a context-aware AI copilot that lives as a side panel overlay in the Órbita admin panel and onboarding wizard, capable of guiding users, filling form fields, navigating between modules, and executing CRUD actions via LLM function calling with real-time visual feedback.

**Architecture:** NestJS backend module (`OrbiModule`) with SSE streaming endpoint, provider-agnostic LLM adapter (starting with Groq), tool registry pattern mapping LLM function calls to existing services. Next.js frontend with Zustand-powered side panel overlay, SSE client hook, and context awareness via URL parsing + store introspection.

**Tech Stack:** NestJS (backend), Next.js Pages Router (frontend), Zustand (state), Groq SDK (LLM, swappable), Prisma (persistence), SSE (streaming protocol)

**Spec:** `docs/superpowers/specs/2026-08-25-orbi-ai-assistant-design.md`

## Global Constraints

- Auth: custom JWT (HS256), NOT Supabase Auth — see `apps/api/src/auth/auth.service.ts`
- Multi-tenant: every API action scoped to `businessId` from session
- Wizard mode: no auth (public endpoint, rate-limited) — user has no account yet
- Styling: use CSS variables from `apps/web/src/design-system/tokens/colors.ts` — inline styles pattern matches existing codebase
- Español rioplatense for all user-facing copy (tuteo con vos)
- Zone prohibida: tools for delete-business, change-plan, modify-credentials, remove-members MUST NOT exist in the registry

---

### Task 1: Backend — LLM Adapter + OrbiModule with SSE Chat

Creates the backend foundation: a provider-agnostic LLM interface, Groq implementation, SSE endpoint, conversation persistence, and basic text-only chat.

**Files:**
- Create: `apps/api/src/orbi/orbi.module.ts`
- Create: `apps/api/src/orbi/orbi.controller.ts`
- Create: `apps/api/src/orbi/dto/orbi-chat.dto.ts`
- Create: `apps/api/src/orbi/llm/llm-adapter.interface.ts`
- Create: `apps/api/src/orbi/llm/groq.adapter.ts`
- Create: `apps/api/src/orbi/conversation/conversation.service.ts`
- Modify: `apps/api/src/app.module.ts` (register OrbiModule)
- Modify: `apps/api/prisma/schema.prisma` (add OrbiConversation model)
- Create: `apps/api/src/orbi/orbi.controller.spec.ts`
- Create: `apps/api/src/orbi/llm/groq.adapter.spec.ts`

**Interfaces:**
- Consumes: `AuthGuard`, `@Public()` decorator, `PrismaService`, `ConfigService`, Groq SDK
- Produces:
  - `LlmAdapter` interface with `streamChat(params): AsyncGenerator<LlmEvent>`
  - `GroqAdapter` implementing `LlmAdapter`
  - `POST /orbi/chat` SSE endpoint accepting `OrbiChatDto`, returning `text/event-stream`
  - `ConversationService` with `getOrCreate(businessId, userId, surface): Promise<Conversation>`, `appendMessage(conversationId, message): Promise<void>`

- [ ] **Step 1: Create LLM adapter interface**

Create `apps/api/src/orbi/llm/llm-adapter.interface.ts`:

```typescript
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type LlmEvent =
  | { type: 'text'; chunk: string }
  | { type: 'tool_call'; call: LlmToolCall }
  | { type: 'done' };

export interface LlmAdapter {
  streamChat(params: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
  }): AsyncGenerator<LlmEvent>;
}

export const LLM_ADAPTER = Symbol('LLM_ADAPTER');
```

- [ ] **Step 2: Implement Groq adapter**

Create `apps/api/src/orbi/llm/groq.adapter.ts`. The existing `ProductAiService` uses `groq-sdk` — follow the same lazy-init pattern with `ConfigService`:

```typescript
import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from './llm-adapter.interface';

@Injectable()
export class GroqAdapter implements LlmAdapter {
  private readonly logger = new Logger(GroqAdapter.name);
  private client: Groq | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Groq {
    if (!this.client) {
      const apiKey = this.config.get<string>('GROQ_API_KEY');
      if (!apiKey) throw new ServiceUnavailableException('GROQ_API_KEY no configurada');
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }

  async *streamChat(params: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
  }): AsyncGenerator<LlmEvent> {
    const client = this.getClient();

    const groqTools = params.tools?.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const stream = await client.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: params.messages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId! };
        }
        return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
      }),
      tools: groqTools?.length ? groqTools : undefined,
      stream: true,
      max_completion_tokens: 4096,
    });

    let currentToolCall: { id: string; name: string; argsJson: string } | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { type: 'text', chunk: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id) {
            // Flush previous tool call if any
            if (currentToolCall) {
              yield {
                type: 'tool_call',
                call: {
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: JSON.parse(currentToolCall.argsJson || '{}'),
                },
              };
            }
            currentToolCall = { id: tc.id, name: tc.function?.name ?? '', argsJson: '' };
          }
          if (tc.function?.arguments) {
            if (currentToolCall) currentToolCall.argsJson += tc.function.arguments;
          }
        }
      }
    }

    // Flush last tool call
    if (currentToolCall) {
      yield {
        type: 'tool_call',
        call: {
          id: currentToolCall.id,
          name: currentToolCall.name,
          arguments: JSON.parse(currentToolCall.argsJson || '{}'),
        },
      };
    }

    yield { type: 'done' };
  }
}
```

- [ ] **Step 3: Create DTO for the chat endpoint**

Create `apps/api/src/orbi/dto/orbi-chat.dto.ts`:

```typescript
import { IsString, IsOptional, IsObject, IsArray, IsEnum, IsUUID } from 'class-validator';

export enum OrbiSurface {
  WIZARD = 'wizard',
  PANEL = 'panel',
}

export class OrbiContextDto {
  @IsEnum(OrbiSurface)
  surface: OrbiSurface;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsUUID()
  businessId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class OrbiChatDto {
  @IsString()
  message: string;

  @IsObject()
  context: OrbiContextDto;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
```

- [ ] **Step 4: Add Prisma model for conversation persistence**

Add to `apps/api/prisma/schema.prisma`:

```prisma
model OrbiConversation {
  id         String   @id @default(uuid())
  businessId String   @map("business_id")
  userId     String   @map("user_id")
  surface    String   // 'wizard' | 'panel'
  messages   Json     @default("[]") // [{role, content, timestamp, toolCalls?}]
  context    Json?    // last context sent
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@map("orbi_conversations")
}
```

Add the inverse relation in the `Business` model:

```prisma
orbiConversations OrbiConversation[]
```

Run: `cd apps/api && npx prisma migrate dev --name add-orbi-conversations`

- [ ] **Step 5: Create conversation service**

Create `apps/api/src/orbi/conversation/conversation.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
}

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(businessId: string, userId: string, surface: string) {
    const existing = await this.prisma.orbiConversation.findFirst({
      where: { businessId, userId, surface },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;

    return this.prisma.orbiConversation.create({
      data: { businessId, userId, surface, messages: [] },
    });
  }

  async appendMessage(conversationId: string, message: ConversationMessage) {
    const conv = await this.prisma.orbiConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    const messages = conv.messages as ConversationMessage[];
    messages.push(message);
    await this.prisma.orbiConversation.update({
      where: { id: conversationId },
      data: { messages, updatedAt: new Date() },
    });
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const conv = await this.prisma.orbiConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    return conv.messages as ConversationMessage[];
  }
}
```

- [ ] **Step 6: Create OrbiController with SSE endpoint**

Create `apps/api/src/orbi/orbi.controller.ts`:

```typescript
import { Controller, Post, Body, Res, HttpCode, Inject, Logger } from '@nestjs/common';
import { Response } from 'express';
import { OrbiChatDto, OrbiSurface } from './dto/orbi-chat.dto';
import { LLM_ADAPTER, type LlmAdapter, type LlmMessage } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthContext } from '../common/types/auth-context.type';

@Controller('orbi')
export class OrbiController {
  private readonly logger = new Logger(OrbiController.name);

  constructor(
    @Inject(LLM_ADAPTER) private readonly llm: LlmAdapter,
    private readonly conversationService: ConversationService,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(
    @Body() dto: OrbiChatDto,
    @Res() res: Response,
    @CurrentUser() user: AuthContext,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      // For panel mode, persist conversation
      let conversationId = dto.conversationId;
      let history: LlmMessage[] = [];

      if (dto.context.surface === OrbiSurface.PANEL && user.type === 'member') {
        const conv = conversationId
          ? { id: conversationId }
          : await this.conversationService.getOrCreate(user.businessId, user.memberId, 'panel');
        conversationId = conv.id;

        if (dto.conversationId) {
          const msgs = await this.conversationService.getMessages(conversationId);
          history = msgs.map(m => ({ role: m.role, content: m.content }));
        }

        await this.conversationService.appendMessage(conversationId, {
          role: 'user',
          content: dto.message,
          timestamp: new Date().toISOString(),
        });
      }

      const systemPrompt = this.buildBasicSystemPrompt(dto);
      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: dto.message },
      ];

      let fullResponse = '';

      for await (const event of this.llm.streamChat({ messages })) {
        if (event.type === 'text') {
          fullResponse += event.chunk;
          res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
        } else if (event.type === 'done') {
          res.write(`event: done\ndata: {}\n\n`);
        }
      }

      // Persist assistant response
      if (dto.context.surface === OrbiSurface.PANEL && conversationId) {
        await this.conversationService.appendMessage(conversationId, {
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Orbi chat error: ${error}`);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Error procesando tu mensaje' })}\n\n`);
    } finally {
      res.end();
    }
  }

  // Wizard mode: public, no auth required
  @Post('chat/wizard')
  @Public()
  @HttpCode(200)
  async chatWizard(@Body() dto: OrbiChatDto, @Res() res: Response) {
    dto.context.surface = OrbiSurface.WIZARD;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const systemPrompt = this.buildBasicSystemPrompt(dto);
      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: dto.message },
      ];

      for await (const event of this.llm.streamChat({ messages })) {
        if (event.type === 'text') {
          res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
        } else if (event.type === 'done') {
          res.write(`event: done\ndata: {}\n\n`);
        }
      }
    } catch (error) {
      this.logger.error(`Orbi wizard chat error: ${error}`);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Error procesando tu mensaje' })}\n\n`);
    } finally {
      res.end();
    }
  }

  private buildBasicSystemPrompt(dto: OrbiChatDto): string {
    const surface = dto.context.surface === OrbiSurface.WIZARD ? 'wizard de onboarding' : 'panel administrativo';
    const moduleCtx = dto.context.module ? ` Está en el módulo "${dto.context.module}"` : '';
    const sectionCtx = dto.context.section ? `, sección "${dto.context.section}"` : '';

    return (
      `Sos Orbi, el asistente de IA de Órbita — una plataforma de comercio online para negocios en Argentina. ` +
      `Hablás en español rioplatense, con tono cercano y directo. Sin emojis salvo que el usuario los use. ` +
      `El usuario está en el ${surface}.${moduleCtx}${sectionCtx}. ` +
      `Respondé de forma concisa y útil. Si no podés hacer algo, explicá cómo hacerlo manualmente.`
    );
  }
}
```

- [ ] **Step 7: Create OrbiModule and register in AppModule**

Create `apps/api/src/orbi/orbi.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { OrbiController } from './orbi.controller';
import { GroqAdapter } from './llm/groq.adapter';
import { LLM_ADAPTER } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';

@Module({
  controllers: [OrbiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: GroqAdapter },
    ConversationService,
  ],
})
export class OrbiModule {}
```

Add `OrbiModule` to the `imports` array in `apps/api/src/app.module.ts`.

- [ ] **Step 8: Write unit test for GroqAdapter**

Create `apps/api/src/orbi/llm/groq.adapter.spec.ts`. Mock the Groq SDK and verify:
- Streams text chunks as `LlmEvent` with `type: 'text'`
- Parses tool calls from streamed deltas
- Yields `done` event at end
- Throws `ServiceUnavailableException` when `GROQ_API_KEY` is missing

- [ ] **Step 9: Write integration test for OrbiController**

Create `apps/api/src/orbi/orbi.controller.spec.ts`. Mock `LLM_ADAPTER` with a fake generator that yields two text chunks and a done event. Verify:
- `POST /orbi/chat` returns `Content-Type: text/event-stream`
- Response body contains `event: text` lines with chunks
- Response ends with `event: done`
- `POST /orbi/chat/wizard` works without auth (public endpoint)

- [ ] **Step 10: Verify the migration runs and API starts**

Run:
```bash
cd apps/api
npx prisma migrate dev --name add-orbi-conversations
npm run start:dev
```

Test with curl:
```bash
curl -N -X POST http://localhost:3000/api/v1/orbi/chat/wizard \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola, necesito ayuda","context":{"surface":"wizard"}}'
```

Expected: SSE stream with text chunks from Groq.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/orbi/ apps/api/prisma/schema.prisma apps/api/prisma/migrations/ apps/api/src/app.module.ts
git commit -m "feat(orbi): backend foundation — LLM adapter, SSE endpoint, conversation persistence"
```

---

### Task 2: Backend — Context Builder + Tool Registry

Replaces the basic system prompt with a dynamic context builder and adds the tool registry pattern that maps LLM function calls to executable actions.

**Files:**
- Create: `apps/api/src/orbi/context/context-builder.service.ts`
- Create: `apps/api/src/orbi/tools/tool-registry.service.ts`
- Create: `apps/api/src/orbi/tools/tool.interface.ts`
- Create: `apps/api/src/orbi/tools/definitions/navigation.tool.ts`
- Modify: `apps/api/src/orbi/orbi.controller.ts` (wire context builder + tool execution loop)
- Modify: `apps/api/src/orbi/orbi.module.ts` (register new providers)
- Create: `apps/api/src/orbi/context/context-builder.spec.ts`
- Create: `apps/api/src/orbi/tools/tool-registry.spec.ts`

**Interfaces:**
- Consumes: `LlmAdapter.streamChat()`, `LlmToolDefinition`, `OrbiChatDto`, `PrismaService`
- Produces:
  - `OrbiTool` interface: `{ name, description, parameters, surfaces, requiredPermissions, execute(args, ctx) }`
  - `ToolRegistryService` with `getTools(surface, permissions): OrbiTool[]`, `execute(name, args, ctx): Promise<ToolResult>`
  - `ContextBuilderService` with `buildSystemPrompt(dto, businessData?): string`
  - `NavigationTool` implementing `OrbiTool`

- [ ] **Step 1: Define the tool interface**

Create `apps/api/src/orbi/tools/tool.interface.ts`:

```typescript
import type { LlmToolDefinition } from '../llm/llm-adapter.interface';
import type { OrbiSurface } from '../dto/orbi-chat.dto';

export interface ToolExecutionContext {
  businessId: string;
  userId: string;
  surface: OrbiSurface;
  permissions: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  label: string; // human-readable step label for frontend pipeline
}

export interface OrbiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  surfaces: OrbiSurface[]; // which surfaces this tool is available in
  requiredPermissions: string[]; // empty = no permission needed
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult>;
  toLlmDefinition(): LlmToolDefinition;
}
```

- [ ] **Step 2: Create ToolRegistryService**

Create `apps/api/src/orbi/tools/tool-registry.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import type { OrbiTool, ToolExecutionContext, ToolResult } from './tool.interface';
import type { OrbiSurface } from '../dto/orbi-chat.dto';
import type { LlmToolDefinition } from '../llm/llm-adapter.interface';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, OrbiTool>();

  register(tool: OrbiTool) {
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered tool: ${tool.name}`);
  }

  getTools(surface: OrbiSurface, permissions: string[]): LlmToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.surfaces.includes(surface))
      .filter(t =>
        t.requiredPermissions.length === 0 ||
        t.requiredPermissions.every(p => permissions.includes(p)),
      )
      .map(t => t.toLlmDefinition());
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, error: `Tool "${name}" no existe`, label: name };

    if (!tool.surfaces.includes(ctx.surface)) {
      return { success: false, error: `"${name}" no disponible en ${ctx.surface}`, label: name };
    }

    if (tool.requiredPermissions.length > 0) {
      const missing = tool.requiredPermissions.filter(p => !ctx.permissions.includes(p));
      if (missing.length > 0) {
        return { success: false, error: `Permisos insuficientes: ${missing.join(', ')}`, label: name };
      }
    }

    return tool.execute(args, ctx);
  }
}
```

- [ ] **Step 3: Create navigation tool**

Create `apps/api/src/orbi/tools/definitions/navigation.tool.ts`:

```typescript
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';

export class NavigationTool implements OrbiTool {
  name = 'navigateTo';
  description = 'Navegar al usuario a un módulo o sección específica del panel administrativo. Usalo cuando el usuario pregunte dónde encontrar algo o necesite ir a otro módulo.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      module: {
        type: 'string',
        description: 'Módulo destino: dashboard, pedidos, catalogo, clientes, mensajes, descuentos, configuracion, perfil',
      },
      section: {
        type: 'string',
        description: 'Sección dentro del módulo (opcional). Ej: para configuracion puede ser "envios", "pagos", "apariencia"',
      },
    },
    required: ['module'],
  };

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    // Navigation is client-side only — we just return the target path
    // and the frontend handles router.push()
    const module = args.module as string;
    const section = args.section as string | undefined;
    const path = section ? `/admin/ventas/${module}/${section}` : `/admin/ventas/${module}`;

    return {
      success: true,
      label: `Navegando a ${module}${section ? ' → ' + section : ''}`,
      data: { path, module, section },
    };
  }
}
```

- [ ] **Step 4: Create ContextBuilderService**

Create `apps/api/src/orbi/context/context-builder.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrbiChatDto } from '../dto/orbi-chat.dto';
import { OrbiSurface } from '../dto/orbi-chat.dto';

@Injectable()
export class ContextBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSystemPrompt(dto: OrbiChatDto): Promise<string> {
    const parts: string[] = [
      'Sos Orbi, el asistente de IA de Órbita — una plataforma de comercio online para negocios en Argentina.',
      'Hablás en español rioplatense, con tono cercano y directo (tuteás con "vos"). Sin emojis salvo que el usuario los use.',
      'Respondé de forma concisa y útil.',
    ];

    if (dto.context.surface === OrbiSurface.WIZARD) {
      parts.push(
        'El usuario está creando su negocio en el wizard de onboarding. Todavía no tiene cuenta.',
        'Podés ayudarlo a elegir nombre, descripción, subdominio, y llenar los campos del formulario.',
        'NO podés crear productos ni hacer operaciones de negocio — el negocio no existe todavía.',
      );
    } else {
      parts.push(
        `El usuario está en el panel administrativo de su negocio.`,
      );

      if (dto.context.module) {
        parts.push(`Está viendo el módulo "${dto.context.module}"${dto.context.section ? `, sección "${dto.context.section}"` : ''}.`);
      }

      // Fetch business context for richer prompts
      if (dto.context.businessId) {
        try {
          const biz = await this.prisma.business.findUnique({
            where: { id: dto.context.businessId },
            select: { name: true, industry: true, mode: true },
          });
          if (biz) {
            parts.push(`El negocio se llama "${biz.name}", rubro "${biz.industry}", modo ${biz.mode === 'FULL' ? 'venta online' : 'vidriera digital'}.`);
          }
        } catch { /* non-critical — continue without business context */ }
      }

      parts.push(
        'Podés ejecutar acciones usando las herramientas disponibles.',
        'NUNCA hagas acciones de zona peligrosa: eliminar negocio, cambiar plan, modificar contraseñas, remover miembros.',
        'Si el usuario pide algo de zona peligrosa, explicale que no podés hacerlo y decile cómo hacerlo manualmente.',
        'Si no tenés una herramienta para algo, explicá los pasos para hacerlo manualmente en el panel.',
      );
    }

    return parts.join(' ');
  }
}
```

- [ ] **Step 5: Wire context builder + tool execution loop into OrbiController**

Modify `apps/api/src/orbi/orbi.controller.ts` — replace `buildBasicSystemPrompt` with `ContextBuilderService`, add the tool call loop:

The key change is in the `chat()` method: after getting a `tool_call` event from the LLM, execute the tool via `ToolRegistryService`, send `action_start`/`action_complete` SSE events, append the tool result as a message, and re-stream the LLM for the follow-up response.

```typescript
// In the chat() method, after building messages:
const tools = this.toolRegistry.getTools(dto.context.surface, dto.context.permissions ?? []);
const toolCtx: ToolExecutionContext = {
  businessId: user.type === 'member' ? user.businessId : '',
  userId: user.type === 'member' ? user.memberId : '',
  surface: dto.context.surface,
  permissions: dto.context.permissions ?? [],
};

let continueLoop = true;
while (continueLoop) {
  continueLoop = false;
  for await (const event of this.llm.streamChat({ messages, tools })) {
    if (event.type === 'text') {
      fullResponse += event.chunk;
      res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
    } else if (event.type === 'tool_call') {
      const stepId = `step-${Date.now()}`;
      res.write(`event: action_start\ndata: ${JSON.stringify({ id: stepId, label: event.call.name, tool: event.call.name })}\n\n`);

      const result = await this.toolRegistry.execute(event.call.name, event.call.arguments, toolCtx);

      res.write(`event: action_complete\ndata: ${JSON.stringify({ id: stepId, result: result.label, data: result.data })}\n\n`);

      // Append tool call + result to messages for LLM continuation
      messages.push({ role: 'assistant', content: '', toolCallId: event.call.id });
      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: event.call.id,
      });
      continueLoop = true; // Re-enter loop for LLM to process tool result
    } else if (event.type === 'done') {
      if (!continueLoop) {
        res.write(`event: done\ndata: {}\n\n`);
      }
    }
  }
}
```

- [ ] **Step 6: Update OrbiModule to register new providers**

```typescript
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { NavigationTool } from './tools/definitions/navigation.tool';

@Module({
  controllers: [OrbiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: GroqAdapter },
    ConversationService,
    ContextBuilderService,
    ToolRegistryService,
  ],
})
export class OrbiModule {
  constructor(private readonly toolRegistry: ToolRegistryService) {
    this.toolRegistry.register(new NavigationTool());
  }
}
```

- [ ] **Step 7: Write tests for ContextBuilder and ToolRegistry**

Test that:
- ContextBuilder includes module name when provided
- ContextBuilder adds wizard-specific instructions for wizard surface
- ContextBuilder adds zone-prohibida warning for panel surface
- ToolRegistry filters tools by surface
- ToolRegistry filters tools by permissions
- ToolRegistry.execute returns error for non-existent tool
- NavigationTool returns correct path

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/orbi/
git commit -m "feat(orbi): context builder, tool registry, and navigation tool"
```

---

### Task 3: Backend — Product Tools

Adds the most valuable tool set: creating, updating, and listing products via ORBI with AI-generated descriptions and background removal.

**Files:**
- Create: `apps/api/src/orbi/tools/definitions/product.tools.ts`
- Modify: `apps/api/src/orbi/orbi.module.ts` (import ProductsModule, register product tools)

**Interfaces:**
- Consumes: `ProductsService` (existing), `ProductAiService` (existing), `BackgroundRemovalService` (existing), `ToolRegistryService.register()`, `OrbiTool` interface
- Produces: `CreateProductTool`, `ListProductsTool`, `GenerateDescriptionTool` — all implementing `OrbiTool`

- [ ] **Step 1: Create product tool definitions**

Create `apps/api/src/orbi/tools/definitions/product.tools.ts` with three tool classes:

**`ListProductsTool`** — queries products for context. Parameters: `{ limit?: number, search?: string }`. Calls `ProductsService.findAll(businessId, ...)`. Returns simplified list `[{ id, name, price, stock }]`. No permissions required (read-only context).

**`CreateProductTool`** — creates a product. Parameters: `{ name, description?, price, categoryId?, tags? }`. Calls `ProductsService.create(businessId, ...)`. Required permission: `products:write`. Returns `{ productId, name }`.

**`GenerateDescriptionTool`** — generates AI description. Parameters: `{ productName, existingDescription? }`. Calls `ProductAiService.assist(businessId, ...)`. No special permission. Returns `{ description, suggestedTags, suggestedSpecs }`.

Each class implements the full `OrbiTool` interface with `toLlmDefinition()` and `execute()`.

- [ ] **Step 2: Register product tools in OrbiModule**

Import `ProductsModule` (which exports `ProductsService` and `ProductAiService`) into `OrbiModule`. Create a factory provider or use `onModuleInit` to register the product tools with `ToolRegistryService`, injecting the required services.

- [ ] **Step 3: Test product tools**

Write unit tests verifying:
- `CreateProductTool` calls `ProductsService.create` with correct args
- `ListProductsTool` returns simplified product list
- `GenerateDescriptionTool` passes through to `ProductAiService.assist`
- Permission filtering works (createProduct requires `products:write`)

- [ ] **Step 4: Manual integration test**

With the API running, test via curl:
```bash
curl -N -X POST http://localhost:3000/api/v1/orbi/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message":"Listame los productos","context":{"surface":"panel","module":"productos","businessId":"<id>","permissions":["products:read","products:write"]}}'
```

Expected: SSE stream with `action_start` → `action_complete` for `listProducts`, then text summary.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orbi/
git commit -m "feat(orbi): product tools — create, list, generate description"
```

---

### Task 4: Frontend — OrbiPanel Side Panel + SSE Hook

Replaces the demo `OrbiChat` floating button with the production `OrbiPanel` side panel overlay. Adds SSE streaming, Zustand store, and context awareness.

**Files:**
- Create: `apps/web/src/components/orbi/OrbiPanel.tsx`
- Create: `apps/web/src/components/orbi/OrbiTrigger.tsx`
- Create: `apps/web/src/components/orbi/OrbiMessages.tsx`
- Create: `apps/web/src/components/orbi/OrbiInput.tsx`
- Create: `apps/web/src/components/orbi/OrbiPipeline.tsx`
- Create: `apps/web/src/components/orbi/OrbiNavigateButton.tsx`
- Create: `apps/web/src/components/orbi/OrbiDataCard.tsx`
- Create: `apps/web/src/components/orbi/useOrbiStore.ts`
- Create: `apps/web/src/components/orbi/useOrbiChat.ts`
- Create: `apps/web/src/components/orbi/useOrbiContext.ts`
- Create: `apps/web/src/components/orbi/types.ts`
- Modify: `apps/web/src/layouts/AdminLayout.tsx` (add OrbiPanel + OrbiTrigger)
- Modify: `apps/web/src/layouts/components/Sidebar.tsx` (add Orbi button at bottom)

**Interfaces:**
- Consumes: `authedFetch` from `@/lib/auth/authClient`, `useRouter` from `next/router`, `useOnboardingStore`, Zustand
- Produces:
  - `useOrbiStore` — `{ isOpen, toggle(), messages, addMessage(), activeActions, conversationId }`
  - `useOrbiChat` — `{ send(message, context), isStreaming }`
  - `useOrbiContext` — `{ surface, module, section, businessId, permissions }`
  - `<OrbiPanel />` — self-contained side panel component
  - `<OrbiTrigger />` — sidebar button component

- [ ] **Step 1: Define shared types**

Create `apps/web/src/components/orbi/types.ts`:

```typescript
export type OrbiSurface = 'wizard' | 'panel';

export interface OrbiContext {
  surface: OrbiSurface;
  module?: string;
  section?: string;
  businessId?: string;
  permissions?: string[];
}

export type OrbiMessageRole = 'user' | 'assistant';

export interface OrbiAction {
  id: string;
  label: string;
  tool: string;
  status: 'active' | 'complete' | 'error';
  result?: string;
  data?: Record<string, unknown>;
}

export interface OrbiMessage {
  id: string;
  role: OrbiMessageRole;
  content: string;
  actions?: OrbiAction[];
  timestamp: number;
}
```

- [ ] **Step 2: Create Zustand store**

Create `apps/web/src/components/orbi/useOrbiStore.ts`:

```typescript
import { create } from 'zustand';
import type { OrbiMessage, OrbiAction } from './types';

interface OrbiState {
  isOpen: boolean;
  messages: OrbiMessage[];
  conversationId: string | null;
  isStreaming: boolean;

  toggle: () => void;
  open: () => void;
  close: () => void;
  addMessage: (msg: OrbiMessage) => void;
  appendToLastAssistant: (chunk: string) => void;
  addActionToLastAssistant: (action: OrbiAction) => void;
  updateAction: (msgId: string, actionId: string, update: Partial<OrbiAction>) => void;
  setStreaming: (v: boolean) => void;
  setConversationId: (id: string) => void;
  reset: () => void;
}

export const useOrbiStore = create<OrbiState>((set) => ({
  isOpen: false,
  messages: [],
  conversationId: null,
  isStreaming: false,

  toggle: () => set(s => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),

  appendToLastAssistant: (chunk) => set(s => {
    const msgs = [...s.messages];
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant') {
      last.content += chunk;
    }
    return { messages: msgs };
  }),

  addActionToLastAssistant: (action) => set(s => {
    const msgs = [...s.messages];
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant') {
      last.actions = [...(last.actions ?? []), action];
    }
    return { messages: msgs };
  }),

  updateAction: (msgId, actionId, update) => set(s => {
    const msgs = s.messages.map(m => {
      if (m.id !== msgId) return m;
      return {
        ...m,
        actions: m.actions?.map(a => a.id === actionId ? { ...a, ...update } : a),
      };
    });
    return { messages: msgs };
  }),

  setStreaming: (v) => set({ isStreaming: v }),
  setConversationId: (id) => set({ conversationId: id }),
  reset: () => set({ messages: [], conversationId: null, isStreaming: false }),
}));
```

- [ ] **Step 3: Create SSE chat hook**

Create `apps/web/src/components/orbi/useOrbiChat.ts`:

```typescript
import { useCallback } from 'react';
import { useOrbiStore } from './useOrbiStore';
import type { OrbiContext, OrbiMessage } from './types';
import { authedFetch } from '@/lib/auth/authClient';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export function useOrbiChat() {
  const store = useOrbiStore();

  const send = useCallback(async (message: string, context: OrbiContext) => {
    const userMsg: OrbiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    store.addMessage(userMsg);

    const assistantMsg: OrbiMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      actions: [],
      timestamp: Date.now(),
    };
    store.addMessage(assistantMsg);
    store.setStreaming(true);

    try {
      const endpoint = context.surface === 'wizard' ? '/orbi/chat/wizard' : '/orbi/chat';
      const fetchFn = context.surface === 'wizard' ? fetch : authedFetch;

      const res = await fetchFn(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context,
          conversationId: store.conversationId,
        }),
      });

      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (eventType === 'text') {
              store.appendToLastAssistant(data.chunk);
            } else if (eventType === 'action_start') {
              store.addActionToLastAssistant({
                id: data.id,
                label: data.label,
                tool: data.tool,
                status: 'active',
              });
            } else if (eventType === 'action_complete') {
              store.updateAction(assistantMsg.id, data.id, {
                status: 'complete',
                result: data.result,
                data: data.data,
              });
            } else if (eventType === 'error') {
              store.appendToLastAssistant(data.message ?? 'Error procesando tu mensaje');
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      store.appendToLastAssistant('Error de conexión. Intentá de nuevo.');
    } finally {
      store.setStreaming(false);
    }
  }, [store]);

  return { send, isStreaming: store.isStreaming };
}
```

- [ ] **Step 4: Create context awareness hook**

Create `apps/web/src/components/orbi/useOrbiContext.ts`:

```typescript
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import type { OrbiContext } from './types';

export function useOrbiContext(): OrbiContext {
  const router = useRouter();
  const { slug } = router.query;

  return useMemo(() => {
    // Detect wizard surface
    if (router.pathname.startsWith('/onboarding')) {
      return { surface: 'wizard' as const };
    }

    // Admin panel: parse module/section from slug
    const partes = Array.isArray(slug) ? slug : [];
    const section = partes[partes.length - 1];
    const module = partes[partes.length - 2];

    return {
      surface: 'panel' as const,
      module: module ?? undefined,
      section: section ?? undefined,
      // businessId and permissions will be injected from AuthContext
    };
  }, [router.pathname, slug]);
}
```

- [ ] **Step 5: Create OrbiMessages component**

Create `apps/web/src/components/orbi/OrbiMessages.tsx` — renders the message list. For user messages: blue bubble (#3B82F6) right-aligned. For assistant messages: gray bubble (#F1F5F9) left-aligned with Orbi icon. Renders `OrbiPipeline` inline when message has `actions`. Uses the same `OrbiIcon` SVG from the existing `OrbiChat.tsx`.

- [ ] **Step 6: Create OrbiPipeline component**

Create `apps/web/src/components/orbi/OrbiPipeline.tsx` — renders the action feedback card:
- Card with `background: var(--color-surface)`, `border: 1px solid var(--color-border)`, `borderRadius: 10px`
- Each step shows icon + label:
  - `complete` → green checkmark (`#10B981`)
  - `active` → blue dot with CSS pulse animation (`#3B82F6`)
  - pending → gray circle (`#CBD5E1`)
- When all steps complete, card background changes to `#ECFDF5` (success)

- [ ] **Step 7: Create OrbiNavigateButton and OrbiDataCard**

`OrbiNavigateButton`: renders when action data contains a `path`. Blue-tinted button (`background: #EFF6FF`, `color: #1D4ED8`). On click, calls `router.push(data.path)` and closes the panel.

`OrbiDataCard`: renders structured data as a card with label-value rows. Used for report/query responses. White card, alternating rows, green for positive deltas.

- [ ] **Step 8: Create OrbiInput component**

Create `apps/web/src/components/orbi/OrbiInput.tsx` — pill-shaped input field with circular send button. Matches the styling from the existing `OrbiChat.tsx` input area. Handles Enter to send, disables while streaming.

- [ ] **Step 9: Create OrbiPanel (the main side panel)**

Create `apps/web/src/components/orbi/OrbiPanel.tsx` — the assembled side panel:
- `position: fixed`, `right: 0`, `top: 0`, `bottom: 0`, `width: 320px`
- `box-shadow: -6px 0 20px rgba(0,0,0,0.08)`, `z-index: 200`
- Header: Orbi icon + "Orbi" title + context badge (module name) + close button
- Body: `<OrbiMessages />`
- Footer: `<OrbiInput />`
- Slide-in animation from right
- Mobile (< 768px): `width: 100%`, full-screen overlay

- [ ] **Step 10: Create OrbiTrigger for sidebar**

Create `apps/web/src/components/orbi/OrbiTrigger.tsx` — button placed at the bottom of the sidebar. Shows Orbi icon + "Orbi AI" label + `Ctrl+K` shortcut badge. In collapsed sidebar mode, shows only the icon.

- [ ] **Step 11: Integrate into AdminLayout**

Modify `apps/web/src/layouts/AdminLayout.tsx`:
- Import `OrbiPanel` and render it conditionally based on `useOrbiStore().isOpen`
- Import `OrbiTrigger` and add it to `Sidebar`
- Add `Ctrl+K` / `Cmd+K` keyboard shortcut via `useEffect` with `keydown` listener

Modify `apps/web/src/layouts/components/Sidebar.tsx`:
- Add `<OrbiTrigger />` at the bottom of the sidebar, before the close area

- [ ] **Step 12: Verify in browser**

Start the dev server, navigate to the admin panel:
1. Orbi button visible at bottom of sidebar
2. Click it → side panel slides in from right as overlay
3. Type a message → SSE stream renders text chunks in real-time
4. `Ctrl+K` toggles the panel
5. Panel shows correct module badge based on current URL
6. On mobile viewport (< 768px), panel takes full screen

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/components/orbi/ apps/web/src/layouts/
git commit -m "feat(orbi): frontend side panel — OrbiPanel, SSE hook, context awareness, admin integration"
```

---

### Task 5: Frontend — Wizard Integration

Adds proactive nudge detection, Orbi side panel in the wizard, and field pre-fill capability.

**Files:**
- Create: `apps/web/src/components/orbi/OrbiNudge.tsx`
- Create: `apps/web/src/components/orbi/useInactivityDetector.ts`
- Modify: `apps/web/src/modules/onboarding/SetupUnificado.tsx` (add OrbiPanel + OrbiNudge, remove old OrbiChat)
- Modify: `apps/web/src/modules/onboarding/ElegirRubro.tsx` (replace OrbiChat with OrbiTrigger)
- Modify: `apps/web/src/components/orbi/useOrbiContext.ts` (add wizard context with step/field data)
- Modify: `apps/web/src/modules/onboarding/useOnboardingStore.ts` (expose field metadata for ORBI)

**Interfaces:**
- Consumes: `useOnboardingStore`, `useOrbiStore`, `OrbiPanel`
- Produces:
  - `<OrbiNudge field={string} onAccept={fn} onDismiss={fn} />` — proactive nudge bubble
  - `useInactivityDetector(fields, threshold)` — detects idle time per field, returns `idleField`

- [ ] **Step 1: Create inactivity detector hook**

Create `apps/web/src/components/orbi/useInactivityDetector.ts`:

Tracks the last interaction time for each watched field. Accepts a map of `{ fieldName: currentValue }` and a `thresholdMs` (default 30000). Returns `{ idleField: string | null, dismissField(name) }`.

Logic: start a timer per field. When a field's value changes, reset its timer. When a field has been empty for `thresholdMs` with no change, set `idleField` to that field name. `dismissField` permanently excludes a field from detection (user said "no thanks").

- [ ] **Step 2: Create OrbiNudge component**

Create `apps/web/src/components/orbi/OrbiNudge.tsx`:
- Floating bubble, `position: fixed`, bottom-right corner
- Orbi icon + "¿Te ayudo con el {field}?" text
- Two buttons: "Sí, dale" (primary, `#3B82F6`) / "No, gracias" (secondary, `#F1F5F9`)
- Slide-up animation (`fadeUp`)
- On accept: opens OrbiPanel with a pre-composed message asking for help with that field
- On dismiss: calls `dismissField(fieldName)` so it never shows again for that field

- [ ] **Step 3: Extend useOrbiContext for wizard**

Modify `apps/web/src/components/orbi/useOrbiContext.ts`: when on the wizard surface, additionally return:
- `step` (current wizard step index)
- `stepName` (human name: 'rubro', 'tu-negocio', 'ubicacion', etc.)
- `emptyFields` / `filledFields` (from `useOnboardingStore`)
- `rubro` (selected rubro)

- [ ] **Step 4: Integrate into SetupUnificado**

Modify `apps/web/src/modules/onboarding/SetupUnificado.tsx`:
- Remove existing `<OrbiChat>` usage
- Add `<OrbiPanel />` (rendered when `useOrbiStore().isOpen`)
- Add `<OrbiNudge />` that watches fields `['nombre', 'descripcion', 'subdominio']` via `useInactivityDetector`
- Add an Orbi trigger button (FAB style, bottom-right, smaller than admin sidebar version)
- When ORBI sends a response with tool data `{ field, value }` from `fillWizardField`, update the Zustand store value and mark the field as "suggested by Orbi" (purple border + tag)

- [ ] **Step 5: Add "suggested by Orbi" field styling**

In the wizard form inputs that ORBI can fill, add conditional styling:
- When a field was filled by ORBI: `border-color: #8B5CF6`, `background: #F5F3FF`
- Tag below: small text "✦ Sugerido por Orbi — editá si querés" in `#8B5CF6`
- When the user manually edits the field, remove the suggested styling

Track suggested fields in a `Set<string>` in the onboarding store or a local state.

- [ ] **Step 6: Remove old OrbiChat from ElegirRubro**

Replace `<OrbiChat>` in `ElegirRubro.tsx` with a smaller OrbiTrigger FAB button that opens the side panel.

- [ ] **Step 7: Verify in browser**

Test the wizard flow:
1. Go to `/onboarding/rubro`, select a rubro
2. Arrive at "Tu negocio" step — leave "Nombre" empty for 30s
3. Nudge appears: "¿Te ayudo con el nombre?"
4. Click "Sí, dale" → OrbiPanel opens with suggestions
5. Click a suggestion → field fills with purple border + "Sugerido por Orbi" tag
6. Edit the field manually → purple styling disappears
7. Close the nudge with "No, gracias" → it doesn't reappear for that field

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/orbi/ apps/web/src/modules/onboarding/
git commit -m "feat(orbi): wizard integration — proactive nudge, inactivity detection, field pre-fill"
```

---

### Task 6: Backend — Remaining Tools

Adds the full tool catalog: discounts, orders, customers, configuration, and reports.

**Files:**
- Create: `apps/api/src/orbi/tools/definitions/discount.tools.ts`
- Create: `apps/api/src/orbi/tools/definitions/order.tools.ts`
- Create: `apps/api/src/orbi/tools/definitions/customer.tools.ts`
- Create: `apps/api/src/orbi/tools/definitions/config.tools.ts`
- Create: `apps/api/src/orbi/tools/definitions/report.tools.ts`
- Create: `apps/api/src/orbi/tools/definitions/wizard.tools.ts`
- Modify: `apps/api/src/orbi/orbi.module.ts` (import modules, register all tools)

**Interfaces:**
- Consumes: `DiscountsService`, `CouponsService`, `OrdersService`, `CustomersService`, `BusinessesService`, `ToolRegistryService`
- Produces: One `OrbiTool` implementation per action listed in spec sections 7.2–7.8

- [ ] **Step 1: Create discount tools**

`CreateDiscountTool` — wraps `DiscountsService.create()`. Permission: `discounts:write`. Surface: panel only.
`CreateCouponTool` — wraps `CouponsService.create()`. Permission: `discounts:write`. Surface: panel only.
`ListDiscountsTool` — wraps `DiscountsService.findAll()`. No special permission. Surface: panel only.

- [ ] **Step 2: Create order tools**

`ListOrdersTool` — wraps `OrdersService.findAll()`. Read-only. Surface: panel only.
`GetOrderDetailTool` — wraps `OrdersService.findOne()`. Read-only. Surface: panel only.
`UpdateOrderStatusTool` — wraps `OrdersService.updateStatus()`. Permission: `orders:write`. Surface: panel only.

- [ ] **Step 3: Create customer tools**

`ListCustomersTool` — wraps `CustomersService.findAll()`. Read-only. Surface: panel only.
`GetCustomerDetailTool` — wraps `CustomersService.findOne()`. Read-only. Surface: panel only.

- [ ] **Step 4: Create config tools**

`UpdateBusinessInfoTool` — wraps `BusinessesService.update()` for name/description/phone. Permission: `config:write`. Surface: panel only.
`UpdatePaymentMethodsTool` — wraps `BusinessConfigService.update()` for payment methods. Permission: `config:write`. Surface: panel only.
`UpdateShippingTool` — wraps `BusinessConfigService.update()` for shipping config. Permission: `config:write`. Surface: panel only.

- [ ] **Step 5: Create report tools**

`GetSalesReportTool` — wraps `OrdersService` aggregation queries. Read-only. Surface: panel only.
`GetProductReportTool` — wraps `ProductsService` aggregation. Read-only. Surface: panel only.
`GetCustomerReportTool` — wraps `CustomersService` aggregation. Read-only. Surface: panel only.

Each returns structured data that the frontend renders as `OrbiDataCard`.

- [ ] **Step 6: Create wizard tools**

`SuggestBusinessNameTool` — calls LLM with rubro context to generate 3-5 name suggestions. Surface: wizard only. No permissions.
`SuggestDescriptionTool` — calls LLM to generate a business description. Surface: wizard only. No permissions.
`FillWizardFieldTool` — returns a `{ field, value }` payload that the frontend applies to the wizard store. Surface: wizard only. No permissions.

- [ ] **Step 7: Register all tools in OrbiModule**

Update `OrbiModule` to import all required NestJS modules (`DiscountsModule`, `OrdersModule`, `CustomersModule`, `BusinessesModule`) and register every tool with `ToolRegistryService` in `onModuleInit`.

- [ ] **Step 8: Test tool registration**

Write a test that verifies:
- All expected tools are registered
- Panel surface returns all panel tools
- Wizard surface returns only wizard tools
- Permission filtering excludes write tools for read-only users

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/orbi/
git commit -m "feat(orbi): full tool catalog — discounts, orders, customers, config, reports, wizard"
```

---

### Task 7: Polish + Rate Limiting + Cleanup

Final integration, rate limiting for the wizard endpoint, cleanup of old OrbiChat, and mobile responsive adjustments.

**Files:**
- Delete: `apps/web/src/components/OrbiChat.tsx` (replaced by `components/orbi/OrbiPanel.tsx`)
- Modify: `apps/api/src/orbi/orbi.controller.ts` (add rate limiting with `@Throttle`)
- Modify: `apps/web/src/components/orbi/OrbiPanel.tsx` (mobile responsive)
- Modify: any remaining imports of `OrbiChat` across the codebase

**Interfaces:**
- Consumes: `@nestjs/throttler` (add to project if not present)
- Produces: production-ready ORBI with rate limiting and mobile support

- [ ] **Step 1: Add rate limiting to wizard endpoint**

Install `@nestjs/throttler` if not present. Apply `@Throttle({ default: { limit: 10, ttl: 60000 } })` to the `chatWizard()` endpoint. This enforces max 10 requests/minute per IP for the unauthenticated wizard endpoint.

- [ ] **Step 2: Remove old OrbiChat**

Delete `apps/web/src/components/OrbiChat.tsx`. Search the codebase for all imports of `OrbiChat` and update them to use the new `OrbiPanel` + `OrbiTrigger` components. Key files: `SetupUnificado.tsx`, `ElegirRubro.tsx` (should already be done in Task 5, but verify no orphan imports remain).

- [ ] **Step 3: Mobile responsive adjustments**

In `OrbiPanel.tsx`:
- Add `@media (max-width: 768px)` styles: `width: 100%`, `border-radius: 0`
- Add swipe-down gesture to close (optional, nice-to-have)
- In wizard mobile: nudge shows as bottom toast instead of floating bubble

- [ ] **Step 4: Keyboard shortcut edge cases**

Verify `Ctrl+K` / `Cmd+K`:
- Doesn't fire when user is typing in an input field (check `e.target`)
- Works in both admin panel and wizard
- Toggle behavior: open if closed, close if open

- [ ] **Step 5: "Created by Orbi" badge on products**

When `createProduct` tool returns a `productId`, the frontend should temporarily mark that product in the grid. In `ProductoLista` (or wherever the product grid renders), check a `Set<string>` of recently-created-by-orbi product IDs (stored in `useOrbiStore` or a simple `sessionStorage` key). If a product's ID is in the set, render a purple border (`#8B5CF6`) and a "Nuevo ✦" badge. Clear the set on page reload.

- [ ] **Step 6: Final integration test**

End-to-end flow in the browser:
1. **Panel — Guide:** Open Orbi in admin, ask "cómo configuro los envíos?" → get explanation + navigate button
2. **Panel — Execute:** Ask "creame un producto: iPhone 13 Pro Max, $650.000" → see pipeline steps animate → product appears in list
3. **Panel — Query:** Ask "cuánto vendí esta semana?" → see data card with metrics
4. **Wizard — Nudge:** Leave "nombre" empty 30s → nudge appears → accept → suggestions shown
5. **Wizard — Pre-fill:** Click suggestion → field fills with purple border
6. **Mobile:** Resize to mobile → panel goes full-screen

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(orbi): polish — rate limiting, mobile responsive, product badge, cleanup old OrbiChat"
```
