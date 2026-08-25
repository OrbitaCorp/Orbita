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
