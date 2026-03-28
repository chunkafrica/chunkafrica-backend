import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserContextGuard } from '../../common/auth/user-context.guard';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { ListRecipesQueryDto } from './dto/list-recipes-query.dto';
import { RecipesService } from './recipes.service';

@Controller('recipes')
@UseGuards(UserContextGuard, RolesGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  listRecipes(@CurrentUser() user: AuthUser, @Query() query: ListRecipesQueryDto) {
    return this.recipesService.listRecipes(user, query);
  }

  @Get(':recipeId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  getRecipe(
    @CurrentUser() user: AuthUser,
    @Param('recipeId', new ParseUUIDPipe()) recipeId: string,
  ) {
    return this.recipesService.getRecipe(user, recipeId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  createRecipe(@CurrentUser() user: AuthUser, @Body() dto: CreateRecipeDto) {
    return this.recipesService.createRecipe(user, dto);
  }

  @Post(':recipeId/activate')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  activateRecipe(
    @CurrentUser() user: AuthUser,
    @Param('recipeId', new ParseUUIDPipe()) recipeId: string,
  ) {
    return this.recipesService.activateRecipe(user, recipeId);
  }
}