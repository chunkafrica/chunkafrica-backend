import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './common/auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { StoresController } from './common/stores/stores.controller';
import { StoresService } from './common/stores/stores.service';
import { HealthController } from './health.controller';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FinanceModule } from './modules/finance/finance.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductionBatchesModule } from './modules/production-batches/production-batches.module';
import { ReconciliationsModule } from './modules/reconciliations/reconciliations.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StockInModule } from './modules/stock-in/stock-in.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { WasteModule } from './modules/waste/waste.module';

@Module({
  controllers: [HealthController, StoresController],
  providers: [StoresService],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    SuppliersModule,
    CustomersModule,
    InventoryModule,
    FinanceModule,
    StockInModule,
    RecipesModule,
    ProductionBatchesModule,
    OrdersModule,
    WasteModule,
    ReconciliationsModule,
    ReportsModule,
    SettingsModule,
  ],
})
export class AppModule {}
