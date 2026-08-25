import { Test } from '@nestjs/testing';
import { OrbiController } from './orbi.controller';
import { LLM_ADAPTER, type LlmAdapter } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { OrbiSurface } from './dto/orbi-chat.dto';

function createMockResponse() {
  const chunks: string[] = [];
  return {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((data: string) => chunks.push(data)),
    end: jest.fn(),
    chunks,
  };
}

describe('OrbiController', () => {
  let controller: OrbiController;
  let mockLlm: LlmAdapter;

  beforeEach(async () => {
    mockLlm = {
      async *streamChat() {
        yield { type: 'text' as const, chunk: 'Hola, ' };
        yield { type: 'text' as const, chunk: 'soy Orbi' };
        yield { type: 'done' as const };
      },
    };

    const module = await Test.createTestingModule({
      controllers: [OrbiController],
      providers: [
        { provide: LLM_ADAPTER, useValue: mockLlm },
        {
          provide: ConversationService,
          useValue: {
            getOrCreate: jest.fn().mockResolvedValue({ id: 'conv-1' }),
            appendMessage: jest.fn().mockResolvedValue(undefined),
            getMessages: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    controller = module.get(OrbiController);
  });

  it('POST /orbi/chat/wizard returns text/event-stream with chunks', async () => {
    const res = createMockResponse();
    await controller.chatWizard(
      { message: 'Hola', context: { surface: OrbiSurface.WIZARD } } as any,
      res as any,
    );

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.chunks).toContain('event: text\ndata: {"chunk":"Hola, "}\n\n');
    expect(res.chunks).toContain('event: text\ndata: {"chunk":"soy Orbi"}\n\n');
    expect(res.chunks).toContain('event: done\ndata: {}\n\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('POST /orbi/chat streams SSE and persists conversation for panel', async () => {
    const res = createMockResponse();
    const user = {
      type: 'member' as const,
      memberId: 'member-1',
      businessId: 'biz-1',
      businessMode: 'FULL' as const,
      roleId: 'role-1',
      roleName: 'owner',
      permissions: [] as string[],
    };

    await controller.chat(
      { message: 'Hola', context: { surface: OrbiSurface.PANEL } } as any,
      res as any,
      user as any,
    );

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.chunks.some((c) => c.includes('event: text'))).toBe(true);
    expect(res.chunks.some((c) => c.includes('event: done'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });
});
