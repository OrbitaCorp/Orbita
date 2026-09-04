import { Module } from '@nestjs/common';
import { TwoForOneController } from './two-for-one.controller';
import { TwoForOneService } from './two-for-one.service';

@Module({
  controllers: [TwoForOneController],
  providers: [TwoForOneService],
})
export class TwoForOneModule {}
