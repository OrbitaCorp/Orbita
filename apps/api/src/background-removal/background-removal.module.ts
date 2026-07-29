import { Module } from '@nestjs/common';
import { BackgroundRemovalService } from './background-removal.service';

@Module({
  providers: [BackgroundRemovalService],
  exports: [BackgroundRemovalService],
})
export class BackgroundRemovalModule {}
