import { Module } from '@nestjs/common';
import { MenuItemsController } from './menu-items.controller';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  controllers: [MenuItemsController, RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}