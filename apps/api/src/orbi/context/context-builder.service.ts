import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrbiChatDto } from '../dto/orbi-chat.dto';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import { CORE_PROMPT } from '../prompts/core';
import { getWizardPrompt } from '../prompts/wizard';
import { getPanelPrompt } from '../prompts/panel';

@Injectable()
export class ContextBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSystemPrompt(dto: OrbiChatDto): Promise<string> {
    const layers: string[] = [CORE_PROMPT];

    if (dto.context.surface === OrbiSurface.WIZARD) {
      layers.push(getWizardPrompt(
        dto.context.stepName,
        dto.context.rubro,
        dto.context.availableOptions,
        dto.context.formState,
      ));
    } else {
      let businessInfo: { name: string; industry: string; mode: string } | undefined;

      if (dto.context.businessId) {
        try {
          const biz = await this.prisma.business.findUnique({
            where: { id: dto.context.businessId },
            select: { name: true, industry: true, mode: true },
          });
          if (biz) {
            businessInfo = { name: biz.name, industry: biz.industry, mode: biz.mode };
          }
        } catch { /* non-critical */ }
      }

      layers.push(getPanelPrompt(
        dto.context.module,
        dto.context.section,
        businessInfo,
      ));
    }

    return layers.join('\n\n---\n\n');
  }
}
