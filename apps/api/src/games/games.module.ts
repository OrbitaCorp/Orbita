import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { StorefrontGamesController } from './storefront-games.controller';
import { GamesPlayService } from './games-play.service';
import { StorefrontModule } from '../storefront/storefront.module';

@Module({
  imports: [StorefrontModule], // resolveBusinessId() para StorefrontGamesController
  controllers: [GamesController, StorefrontGamesController],
  providers: [GamesService, GamesPlayService],
  exports: [GamesService],
})
export class GamesModule {}
