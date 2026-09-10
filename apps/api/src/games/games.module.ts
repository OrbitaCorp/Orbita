import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { StorefrontGamesController } from './storefront-games.controller';
import { GamesPlayService } from './games-play.service';
import { StorefrontModule } from '../storefront/storefront.module';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    StorefrontModule, // resolveBusinessId() para StorefrontGamesController
    BusinessesModule, // hasActiveAddon() para el gate de los endpoints públicos
  ],
  controllers: [GamesController, StorefrontGamesController],
  providers: [GamesService, GamesPlayService],
  exports: [GamesService],
})
export class GamesModule {}
