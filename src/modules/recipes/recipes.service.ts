import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryItemType, MenuItem, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { ListRecipesQueryDto } from './dto/list-recipes-query.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

const recipeInclude = {
  menuItem: true,
  producedInventoryItem: true,
  recipeItems: {
    include: {
      inventoryItem: true,
    },
  },
  _count: {
    select: {
      productionBatches: true,
    },
  },
} satisfies Prisma.RecipeInclude;

type RecipeWithRelations = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;
type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMenuItems(user: AuthUser, query: ListMenuItemsQueryDto) {
    const where: Prisma.MenuItemWhereInput = {
      businessId: user.businessId,
      deletedAt: query.includeArchived ? undefined : null,
      isActive: query.includeInactive ? undefined : true,
    };

    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    return this.prisma.menuItem.findMany({
      where,
      include: {
        _count: {
          select: {
            recipes: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getMenuItem(user: AuthUser, menuItemId: string) {
    return this.findMenuItemOrThrow(this.prisma, user.businessId, menuItemId, true);
  }

  async createMenuItem(user: AuthUser, dto: CreateMenuItemDto) {
    try {
      const linkedInventoryItem = await this.findFinishedInventoryItemForMenuItemCreate(
        this.prisma,
        user.businessId,
        dto.name,
      );

      return await this.prisma.menuItem.create({
        data: {
          businessId: user.businessId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          defaultPrice: new Prisma.Decimal(dto.defaultPrice),
          isActive: dto.isActive ?? true,
          inventoryItemId: linkedInventoryItem.id,
        },
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A menu item with this name already exists.');
      throw error;
    }
  }

  async updateMenuItem(user: AuthUser, menuItemId: string, dto: UpdateMenuItemDto) {
    await this.findMenuItemOrThrow(this.prisma, user.businessId, menuItemId);

    try {
      return await this.prisma.menuItem.update({
        where: { id: menuItemId },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          defaultPrice:
            dto.defaultPrice !== undefined ? new Prisma.Decimal(dto.defaultPrice) : undefined,
          isActive: dto.isActive,
        },
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A menu item with this name already exists.');
      throw error;
    }
  }

  async archiveMenuItem(user: AuthUser, menuItemId: string) {
    await this.findMenuItemOrThrow(this.prisma, user.businessId, menuItemId);

    return this.prisma.menuItem.update({
      where: { id: menuItemId },
      data: { deletedAt: new Date() },
    });
  }

  async listRecipes(user: AuthUser, query: ListRecipesQueryDto) {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        businessId: user.businessId,
        menuItemId: query.menuItemId,
        isActive: query.isActive,
        deletedAt: query.includeArchived ? undefined : null,
      },
      include: recipeInclude,
      orderBy: [{ menuItemId: 'asc' }, { version: 'desc' }],
    });

    return recipes.map((recipe) => this.serializeRecipe(recipe));
  }

  async getRecipe(user: AuthUser, recipeId: string) {
    const recipe = await this.findRecipeOrThrow(this.prisma, user.businessId, recipeId, true);
    return this.serializeRecipe(recipe);
  }

  async createRecipe(user: AuthUser, dto: CreateRecipeDto) {
    const uniqueIngredientIds = new Set(dto.items.map((item) => item.inventoryItemId));
    if (uniqueIngredientIds.size !== dto.items.length) {
      throw new BadRequestException('Each ingredient may appear only once in a recipe.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const menuItem = await this.findMenuItemOrThrow(tx, user.businessId, dto.menuItemId);
        const producedInventoryItem = await tx.inventoryItem.findFirst({
          where: {
            id: dto.producedInventoryItemId,
            businessId: user.businessId,
            deletedAt: null,
            isActive: true,
          },
        });

        if (!producedInventoryItem) {
          throw new NotFoundException('Produced inventory item not found.');
        }

        if (producedInventoryItem.itemType !== InventoryItemType.FINISHED_GOOD) {
          throw new BadRequestException('producedInventoryItemId must reference a FINISHED_GOOD inventory item.');
        }

        const ingredients = await tx.inventoryItem.findMany({
          where: {
            businessId: user.businessId,
            id: { in: Array.from(uniqueIngredientIds) },
            deletedAt: null,
            isActive: true,
          },
        });

        if (ingredients.length !== uniqueIngredientIds.size) {
          throw new NotFoundException('One or more recipe ingredients could not be found.');
        }

        ingredients.forEach((ingredient) => {
          if (
            ingredient.itemType !== InventoryItemType.RAW_MATERIAL &&
            ingredient.itemType !== InventoryItemType.PACKAGING
          ) {
            throw new BadRequestException(
              'Recipe ingredients must be RAW_MATERIAL or PACKAGING inventory items.',
            );
          }
        });

        const latestRecipe = await tx.recipe.findFirst({
          where: {
            businessId: user.businessId,
            menuItemId: menuItem.id,
          },
          orderBy: { version: 'desc' },
          select: { version: true },
        });

        const existingLiveRecipe = await tx.recipe.findFirst({
          where: {
            businessId: user.businessId,
            menuItemId: menuItem.id,
            deletedAt: null,
          },
          select: { id: true },
        });

        const nextVersion = latestRecipe ? latestRecipe.version + 1 : 1;
        const shouldActivate = existingLiveRecipe ? false : true;

        const recipe = await tx.recipe.create({
          data: {
            businessId: user.businessId,
            menuItemId: menuItem.id,
            producedInventoryItemId: producedInventoryItem.id,
            version: nextVersion,
            yieldQuantity: toDecimal(dto.yieldQuantity)!,
            instructions: dto.instructions?.trim(),
            isActive: shouldActivate,
            recipeItems: {
              create: dto.items.map((item) => ({
                inventoryItemId: item.inventoryItemId,
                quantityRequired: toDecimal(item.quantityRequired)!,
              })),
            },
          },
          include: recipeInclude,
        });

        return this.serializeRecipe(recipe);
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A recipe version conflict occurred. Please retry the request.');
      throw error;
    }
  }

  async activateRecipe(user: AuthUser, recipeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const recipe = await this.findRecipeOrThrow(tx, user.businessId, recipeId);

      await this.lockRecipesForMenuItem(tx, recipe.menuItemId);

      if (recipe.menuItem.deletedAt) {
        throw new BadRequestException('Cannot activate a recipe for an archived menu item.');
      }

      await tx.recipe.updateMany({
        where: {
          businessId: user.businessId,
          menuItemId: recipe.menuItemId,
          deletedAt: null,
          id: { not: recipe.id },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      const activatedRecipe = await tx.recipe.update({
        where: { id: recipe.id },
        data: { isActive: true },
        include: recipeInclude,
      });

      return this.serializeRecipe(activatedRecipe);
    });
  }

  private serializeRecipe(recipe: RecipeWithRelations) {
    const zero = new Prisma.Decimal(0);

    const items = recipe.recipeItems.map((item) => {
      const defaultCostPerUnit = item.inventoryItem.defaultCostPerUnit ?? zero;
      const lineCost = defaultCostPerUnit.mul(item.quantityRequired);

      return {
        ...item,
        defaultCostPerUnit,
        lineCost,
      };
    });

    const computedCostBasis = items.reduce(
      (total, item) => total.plus(item.lineCost),
      new Prisma.Decimal(0),
    );

    const costPerYieldUnit = recipe.yieldQuantity.equals(0)
      ? new Prisma.Decimal(0)
      : computedCostBasis.div(recipe.yieldQuantity);

    return {
      ...recipe,
      recipeItems: items,
      computedCostBasis,
      costPerYieldUnit,
      missingCostItemsCount: items.filter((item) => item.inventoryItem.defaultCostPerUnit === null).length,
      hasProductionHistory: recipe._count.productionBatches > 0,
      productionBatchCount: recipe._count.productionBatches,
    };
  }

  private async findMenuItemOrThrow(
    db: DbClient,
    businessId: string,
    menuItemId: string,
    includeArchived = false,
  ): Promise<MenuItem> {
    const menuItem = await db.menuItem.findFirst({
      where: {
        id: menuItemId,
        businessId,
        deletedAt: includeArchived ? undefined : null,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found.');
    }

    return menuItem;
  }

  private async findRecipeOrThrow(
    db: DbClient,
    businessId: string,
    recipeId: string,
    includeArchived = false,
  ): Promise<RecipeWithRelations> {
    const recipe = await db.recipe.findFirst({
      where: {
        id: recipeId,
        businessId,
        deletedAt: includeArchived ? undefined : null,
      },
      include: recipeInclude,
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found.');
    }

    return recipe;
  }

  private async lockRecipesForMenuItem(db: DbClient, menuItemId: string) {
    // Serialize activations for the same menu item so two requests cannot leave multiple recipes active.
    await db.$queryRaw`
      SELECT id
      FROM "Recipe"
      WHERE "menuItemId" = ${menuItemId}
      FOR UPDATE
    `;
  }

  private async findFinishedInventoryItemForMenuItemCreate(
    db: DbClient,
    businessId: string,
    menuItemName: string,
  ) {
    const normalizedName = menuItemName.trim();

    const inventoryItem = await db.inventoryItem.findFirst({
      where: {
        businessId,
        deletedAt: null,
        isActive: true,
        itemType: InventoryItemType.FINISHED_GOOD,
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!inventoryItem) {
      throw new BadRequestException(
        `Create an active finished good named ${normalizedName} before creating its sellable product.`,
      );
    }

    return inventoryItem;
  }

  private handleUniqueConstraint(error: unknown, message: string): asserts error is Prisma.PrismaClientKnownRequestError {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }
}
