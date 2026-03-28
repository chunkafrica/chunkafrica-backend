# Chunk Food-Production MVP Manual QA and Acceptance Testing Pack

## Scope
This pack covers manual QA for:
- Suppliers
- Inventory
- Stock-In
- Menu Items
- Recipes
- Production Batches
- Waste Logs
- Reconciliations
- Dashboard
- Reports

It also includes end-to-end acceptance flows for:
- Stock-in -> recipe -> activation -> production -> stock movement verification
- Waste logging -> inventory reduction -> waste report verification
- Reconciliation -> variance posting -> inventory adjustment verification
- Order -> fulfillment -> receipt -> sale movement -> dashboard/report verification

## Core Assertions
- Inventory balances are ledger-derived from `StockMovement`, never from a stored quantity field.
- Posted inventory-affecting records are immutable.
- Reconciliation expected balances use `StockMovement.occurredAt <= reconciliation.startedAt`.
- Sales affect stock only at fulfillment, not at order creation.
- Receipts are additive and support partial payments.

## Suggested Test Environment
- One business: `Chunk Test Kitchen`
- One primary store: `Lekki Kitchen`
- One user each for: Owner, Inventory Manager, Production Manager, Finance
- Inventory items:
  - `Flour` (`RAW_MATERIAL`, unit `kg`, restock point `20`, default cost `1500`)
  - `Butter` (`RAW_MATERIAL`, unit `kg`, restock point `5`, default cost `4200`)
  - `Pie Pack` (`PACKAGING`, unit `pcs`, restock point `30`, default cost `120`)
  - `Chicken Pie Batch` (`FINISHED_GOOD`, unit `pcs`, restock point `15`, default selling price `3500`)
- Menu item:
  - `Chicken Pie`
- Supplier:
  - `FreshFarm Supplies`
- Waste categories:
  - `Spoilage`
  - `Damage`

---

## 1. Suppliers QA Checklist

### Scenario: Create supplier successfully
Preconditions:
- Authenticated user belongs to the business.

Test steps:
1. Open `POST /api/v1/suppliers`.
2. Submit a supplier with valid name, contact name, phone, and email.
3. Fetch supplier list.

Expected result:
- Supplier is created under the authenticated user's business.
- Supplier appears in the supplier list.
- `businessId` is not accepted from client input.

Negative/edge case checks:
- Try creating a supplier with a duplicate name in the same business.
- Try creating a supplier with invalid email format.
- Try creating a supplier without a name.

### Scenario: Update supplier safely
Preconditions:
- Existing supplier is present and not archived.

Test steps:
1. Send `PATCH /api/v1/suppliers/:supplierId` with updated phone and address.
2. Fetch supplier detail.

Expected result:
- Mutable fields update successfully.
- Updated values are returned on detail fetch.

Negative/edge case checks:
- Try updating a supplier from another business.
- Try updating an archived supplier.

### Scenario: Soft archive supplier
Preconditions:
- Existing supplier is present.

Test steps:
1. Send `DELETE /api/v1/suppliers/:supplierId`.
2. Fetch active supplier list.

Expected result:
- Supplier is soft-archived.
- Supplier is excluded from active lists.

Negative/edge case checks:
- Try deleting the same supplier twice.
- Confirm historical stock-in records still resolve the archived supplier correctly.

---

## 2. Inventory QA Checklist

### Scenario: Create inventory item successfully
Preconditions:
- Authenticated user belongs to the business.

Test steps:
1. Call `POST /api/v1/inventory/items`.
2. Create one raw material, one packaging item, and one finished good.
3. Fetch inventory item list.

Expected result:
- Items are created with the correct `itemType`.
- Items are business-scoped master data.
- No quantity/on-hand field is stored or returned as a persisted balance.

Negative/edge case checks:
- Try creating an item with invalid `itemType`.
- Try creating an item without `unitOfMeasure`.
- Try creating an item with negative default cost or restock point if validation blocks it.

### Scenario: Update safe inventory fields
Preconditions:
- Inventory item exists.
- Item may or may not have ledger history.

Test steps:
1. Update `name`, `description`, `restockPoint`, `defaultCostPerUnit`, and `defaultSellingPrice`.
2. Fetch item detail.

Expected result:
- Safe fields update successfully.

Negative/edge case checks:
- Try changing `itemType` after the item has ledger history.
- Try changing `unitOfMeasure` after the item has ledger history.
- Confirm the API rejects those mutations.

### Scenario: View ledger-derived on-hand balance
Preconditions:
- Store has stock movements for one or more items.

Test steps:
1. Call `GET /api/v1/stores/:storeId/inventory/on-hand`.
2. Compare returned on-hand quantities to the sum of stock movements per item.

Expected result:
- On-hand equals `SUM(quantityChange)` grouped by `storeId + inventoryItemId`.
- Items with no movements return `0` on-hand.

Negative/edge case checks:
- Query a store from another business.
- Query an empty store with no stock history.

### Scenario: Low-stock query reflects reorder level
Preconditions:
- At least one item's derived on-hand is below or equal to its `restockPoint`.

Test steps:
1. Call `GET /api/v1/stores/:storeId/inventory/low-stock`.
2. Compare the results with inventory balances and reorder levels.

Expected result:
- Only items at or below reorder level are returned.

Negative/edge case checks:
- Items with `restockPoint = null` should not appear as low-stock.
- Inactive or archived items should follow the API's active-only listing rules.

---

## 3. Stock-In QA Checklist

### Scenario: Create stock-in with multiple items
Preconditions:
- Store exists and belongs to the business.
- Supplier exists.
- Inventory items exist.

Test steps:
1. Call `POST /api/v1/stores/:storeId/stock-ins`.
2. Submit two or more stock-in items with quantities and unit costs.
3. Fetch stock-in detail.
4. Fetch stock movements for the stocked items.

Expected result:
- One `StockInRecord` is created.
- One `StockInItem` is created for each line.
- One positive `STOCK_IN` movement is created per line item.
- Inventory on-hand increases based on the ledger.

Negative/edge case checks:
- Try stocking in with an invalid supplier ID.
- Try stocking in an inventory item from another business.
- Try zero or negative quantity.
- Try zero or negative unit cost.

### Scenario: Stock-in history is immutable
Preconditions:
- A stock-in record already exists.

Test steps:
1. Attempt to update the stock-in record.
2. Attempt to delete the stock-in record.

Expected result:
- No edit or delete flow exists for posted stock-in.
- Historical stock-in remains unchanged.

Negative/edge case checks:
- Verify on-hand still reflects the original stock-in after failed edit/delete attempts.

### Scenario: List stock-in history by store
Preconditions:
- Store has one or more stock-in records.

Test steps:
1. Call `GET /api/v1/stores/:storeId/stock-ins`.
2. Open one detail view.

Expected result:
- Results are scoped to the requested store.
- Record detail includes line items and source metadata.

Negative/edge case checks:
- Query a store with no stock-ins.
- Query a store outside the business.

---

## 4. Menu Items QA Checklist

### Scenario: Create menu item successfully
Preconditions:
- Authenticated user belongs to the business.

Test steps:
1. Call `POST /api/v1/menu-items`.
2. Submit a valid menu item name and default price.
3. Fetch menu item list.

Expected result:
- Menu item is created as business-scoped catalog data.
- Menu item appears in active list.

Negative/edge case checks:
- Try duplicate name if uniqueness is enforced at business level.
- Try missing or invalid default price.

### Scenario: Update and archive menu item
Preconditions:
- Menu item exists.

Test steps:
1. Update description and default price.
2. Archive the menu item.
3. Fetch active list.

Expected result:
- Safe fields update.
- Archived menu item disappears from active lists.

Negative/edge case checks:
- Try updating a menu item from another business.
- Confirm existing recipe history remains intact after menu item archive.

---

## 5. Recipes QA Checklist

### Scenario: Create first recipe version
Preconditions:
- Menu item exists.
- Produced inventory item exists and is `FINISHED_GOOD`.
- Ingredient inventory items exist and are `RAW_MATERIAL` or `PACKAGING`.

Test steps:
1. Call `POST /api/v1/recipes`.
2. Submit valid `menuItemId`, `producedInventoryItemId`, `yieldQuantity`, and unique recipe items.
3. Fetch recipe detail.

Expected result:
- Recipe is created with `version = 1`.
- Cost basis is computed from ingredient `defaultCostPerUnit` values.
- Ingredient lines are stored once each.

Negative/edge case checks:
- Try using a produced item that is not `FINISHED_GOOD`.
- Try using duplicate ingredient rows.
- Try using an ingredient with `FINISHED_GOOD` type.
- Try `yieldQuantity <= 0`.

### Scenario: Create new recipe version automatically
Preconditions:
- Menu item already has at least one recipe.

Test steps:
1. Create another recipe for the same menu item.
2. Fetch recipes for that menu item.

Expected result:
- New recipe version increments automatically.
- Previous recipe versions remain intact.

Negative/edge case checks:
- Confirm previous recipe values are unchanged.
- Confirm the system does not overwrite the prior recipe.

### Scenario: Activate recipe and enforce single active version
Preconditions:
- Menu item has at least two recipe versions.

Test steps:
1. Activate version 1.
2. Activate version 2.
3. List recipes for the menu item.

Expected result:
- Only one recipe is active at a time.
- Activation deactivates the prior active recipe in the same transaction.

Negative/edge case checks:
- Try activating a recipe from another business.
- Try activating an archived or invalid recipe.

### Scenario: Used recipes are not editable
Preconditions:
- A production batch has already referenced a recipe.

Test steps:
1. Attempt to edit the used recipe directly.
2. Create a new recipe version instead.

Expected result:
- Direct recipe edit is not allowed.
- New version flow is the supported path.

Negative/edge case checks:
- Confirm production history still points to the original recipe version used.

---

## 6. Production Batches QA Checklist

### Scenario: Create production batch in draft
Preconditions:
- Store exists.
- Active recipe exists for the selected menu item.

Test steps:
1. Call `POST /api/v1/stores/:storeId/production-batches`.
2. Submit `menuItemId`, `recipeId`, `batchDate`, and optional planned output.
3. Fetch batch detail.

Expected result:
- Batch is created in `PLANNED` status.
- Recipe belongs to the same business and matches the menu item.
- Recipe version is snapshotted on the batch.

Negative/edge case checks:
- Try using an inactive recipe.
- Try using a recipe for a different menu item.
- Try using a store outside the business.

### Scenario: Update draft or in-progress batch only
Preconditions:
- Batch is `PLANNED` or `IN_PROGRESS`.

Test steps:
1. Update notes or planned output.
2. Fetch batch detail.

Expected result:
- Update succeeds for editable statuses.

Negative/edge case checks:
- Try updating a `COMPLETED` batch.
- Try updating a `CANCELLED` batch.

### Scenario: Start batch
Preconditions:
- Batch is `PLANNED`.

Test steps:
1. Call `POST /api/v1/stores/:storeId/production-batches/:batchId/start`.
2. Fetch detail.

Expected result:
- Status changes to `IN_PROGRESS`.

Negative/edge case checks:
- Try starting a batch already in progress.
- Try starting a completed or cancelled batch.

### Scenario: Complete batch and post production ledger
Preconditions:
- Batch is `PLANNED` or `IN_PROGRESS`.
- Store has sufficient ingredient stock as of `completedAt`.

Test steps:
1. Call `POST /api/v1/stores/:storeId/production-batches/:batchId/complete`.
2. Provide `actualOutputQuantity > 0`.
3. Omit actual ingredient quantities for one run.
4. Provide actual ingredient quantities for another run.
5. Fetch batch detail and inventory movements.

Expected result:
- Expected ingredient usage is computed from recipe ratio.
- If actual ingredient quantities are omitted, expected quantities are used as actual quantities.
- `ProductionBatchIngredient` rows are created.
- One negative `PRODUCTION_USE` movement is created per consumed ingredient.
- One positive `PRODUCTION_OUTPUT` movement is created for the finished good.
- All production movements use `completedAt` as `occurredAt`.
- Batch becomes `COMPLETED` and is locked from further edits.

Negative/edge case checks:
- Try completion with insufficient ingredient stock.
- Try `actualOutputQuantity <= 0`.
- Try completing the same batch twice.
- Try editing the batch after completion.

### Scenario: Cancel editable batch
Preconditions:
- Batch is `PLANNED` or `IN_PROGRESS`.

Test steps:
1. Call cancel endpoint.
2. Fetch batch detail.

Expected result:
- Batch moves to `CANCELLED`.
- No production ledger entries are created.

Negative/edge case checks:
- Try cancelling a completed batch.

---

## 7. Waste Logs QA Checklist

### Scenario: Create waste category
Preconditions:
- Authenticated user belongs to the business.

Test steps:
1. Call `POST /api/v1/waste-categories`.
2. Submit a name and optional description.
3. Fetch waste category list.

Expected result:
- Waste category is created and listed for the business.

Negative/edge case checks:
- Try duplicate category name.
- Try missing name.

### Scenario: Archive waste category safely
Preconditions:
- Waste category exists.

Test steps:
1. Delete/archive the category.
2. Fetch active categories.

Expected result:
- Category is soft-archived.
- Historical waste logs still retain their category linkage.

Negative/edge case checks:
- Try archiving a category already archived.

### Scenario: Create waste log as posted record
Preconditions:
- Store exists and belongs to business.
- Waste category exists and is active.
- Inventory item exists and has enough ledger-derived on-hand as of `occurredAt`.

Test steps:
1. Call `POST /api/v1/stores/:storeId/waste-logs`.
2. Submit inventory item, waste category, quantity, occurredAt, and optional `costAtLossSnapshot` and note.
3. Fetch waste log detail.
4. Fetch inventory movements for the item.

Expected result:
- Waste log is created.
- One negative `WASTE` movement is created.
- Inventory on-hand decreases based on ledger-derived balance.
- Waste log is immutable after create.

Negative/edge case checks:
- Try quantity `<= 0`.
- Try wasting more than on-hand at `occurredAt`.
- Try using waste category or inventory item from another business.
- Try editing or deleting the waste log after creation.

---

## 8. Reconciliations QA Checklist

### Scenario: Create reconciliation session in DRAFT
Preconditions:
- Store exists and belongs to business.

Test steps:
1. Call `POST /api/v1/stores/:storeId/reconciliations`.
2. Submit `startedAt` and optional notes.
3. Fetch session detail.

Expected result:
- Session is created in `DRAFT`.
- `startedAt` is stored as the reconciliation cut-off timestamp.

Negative/edge case checks:
- Try using a store outside the business.
- Try missing `startedAt`.

### Scenario: Update draft reconciliation only
Preconditions:
- Session is `DRAFT`.

Test steps:
1. Update notes.
2. Fetch detail.

Expected result:
- Draft session updates successfully.

Negative/edge case checks:
- Try updating after posting.

### Scenario: Upsert reconciliation items in draft
Preconditions:
- Draft session exists.
- Inventory items exist.

Test steps:
1. Call `PUT /api/v1/stores/:storeId/reconciliations/:reconciliationId/items`.
2. Submit actual counts for two inventory items.
3. Submit one item again with a new count.
4. Fetch session detail.

Expected result:
- One row exists per `inventoryItemId` per reconciliation.
- Repeated submit updates the same draft item row.
- `actualQuantity >= 0` is enforced.

Negative/edge case checks:
- Try negative `actualQuantity`.
- Try item from another business.
- Try upserting after posting.

### Scenario: Post reconciliation and create variance adjustments
Preconditions:
- Draft reconciliation has item counts.
- Store has stock movement history before `startedAt`.

Test steps:
1. Call `POST /api/v1/stores/:storeId/reconciliations/:reconciliationId/post`.
2. Fetch session detail.
3. Fetch stock movements for the affected items.
4. Open variance report.

Expected result:
- Expected quantity is derived from `StockMovement` where `occurredAt <= startedAt`.
- `varianceQuantity = actualQuantity - expectedQuantity`.
- One `INVENTORY_ADJUSTMENT` movement is created for each non-zero variance row.
- Zero-variance rows do not create adjustment movements.
- Session becomes `POSTED` and is immutable.

Negative/edge case checks:
- Try posting twice.
- Try editing posted session or posted items.
- Confirm `createdAt` of movements is not being used as the accounting basis.

---

## 9. Dashboard QA Checklist

### Scenario: Dashboard overview returns correct store snapshot
Preconditions:
- Store has sales, expenses, stock-ins, production, waste, and reconciliation data in the selected date range.

Test steps:
1. Call `GET /api/v1/stores/:storeId/dashboard/overview?from=...&to=...`.
2. Compare output with raw records in the same date range.

Expected result:
- Total sales equals summed sales for the range.
- Total orders equals count of orders for the range.
- Total expenses equals summed expenses for the range.
- Low-stock uses ledger-derived on-hand versus `restockPoint`.
- Recent stock-ins, production, waste, and reconciliations appear in descending recent order.
- Top selling menu items match the highest quantities sold.
- Variance alerts reflect posted reconciliation adjustments.

Negative/edge case checks:
- Query with a range larger than the max supported window.
- Query an empty store.
- Query a store outside the business.

---

## 10. Reports QA Checklist

### Scenario: Sales report returns range-based sales summary
Preconditions:
- Store has sales orders in the selected range.

Test steps:
1. Call `GET /api/v1/stores/:storeId/reports/sales?from=...&to=...`.
2. Compare totals and counts with underlying orders.

Expected result:
- Summary totals match the selected range.
- Sales by channel and daily sales are correctly grouped.
- Top selling menu items are ordered correctly.

Negative/edge case checks:
- Large range should be rejected if over system cap.
- Empty range should return zeroed summary.

### Scenario: Inventory report uses ledger-derived as-of balances
Preconditions:
- Store has stock movement history.

Test steps:
1. Call `GET /api/v1/stores/:storeId/reports/inventory?asOf=...`.
2. Compare returned on-hand values with the ledger through the same timestamp.

Expected result:
- Inventory balances use `StockMovement.occurredAt <= asOf`.
- Low-stock list matches derived balances.

Negative/edge case checks:
- Query `asOf` before any stock movements.
- Query with inactive items included if supported.

### Scenario: Production report summarizes batch activity
Preconditions:
- Store has production batches in the range.

Test steps:
1. Call `GET /api/v1/stores/:storeId/reports/production?from=...&to=...`.
2. Compare counts and output with production batch records.

Expected result:
- Counts by status are correct.
- Total output quantity equals completed batch output sum.

Negative/edge case checks:
- Range with only planned/cancelled batches.
- Empty range.

### Scenario: Waste report summarizes waste by category
Preconditions:
- Store has waste logs in the range.

Test steps:
1. Call `GET /api/v1/stores/:storeId/reports/waste?from=...&to=...`.
2. Compare totals and category breakdown.

Expected result:
- Waste quantity and cost-at-loss are correct.
- Category grouping is accurate.

Negative/edge case checks:
- Logs with null `costAtLossSnapshot` should not break totals.
- Empty range should return zero totals.

### Scenario: Reconciliation variance report shows posted adjustments only
Preconditions:
- Store has posted reconciliations with non-zero variance in the range.

Test steps:
1. Call `GET /api/v1/stores/:storeId/reports/reconciliation-variance?from=...&to=...`.
2. Compare results with posted reconciliation adjustment movements.

Expected result:
- Report reflects `INVENTORY_ADJUSTMENT` movements only.
- Positive, negative, and net variance totals are correct.
- Alerts point back to the reconciled item/session.

Negative/edge case checks:
- Draft reconciliations should not appear.
- Zero-variance rows should not appear as adjustment alerts.

---

## End-to-End Acceptance Scenarios

### End-to-End Flow 1: Stock-in -> create recipe -> activate recipe -> create production batch -> complete production -> verify stock movements
Preconditions:
- Supplier exists.
- Inventory items exist for ingredients, packaging, and finished good.
- Store exists.
- Menu item exists.

Test steps:
1. Create stock-in for `Flour`, `Butter`, and `Pie Pack`.
2. Verify positive `STOCK_IN` movements were created.
3. Create recipe for `Chicken Pie` using the stocked ingredients and `Chicken Pie Batch` as produced finished good.
4. Activate the recipe.
5. Create production batch in `PLANNED`.
6. Start the batch.
7. Complete the batch with `completedAt` and `actualOutputQuantity`.
8. Fetch production batch detail.
9. Fetch stock movements for each ingredient and finished good.
10. Fetch inventory on-hand.

Expected result:
- Recipe cost basis is computed from inventory default costs.
- Production completion creates `ProductionBatchIngredient` rows.
- Each ingredient receives one negative `PRODUCTION_USE` movement.
- Finished good receives one positive `PRODUCTION_OUTPUT` movement.
- Ingredient on-hand decreases.
- Finished-good on-hand increases.
- Batch becomes `COMPLETED` and cannot be edited.

Negative/edge case checks:
- Attempt completion with insufficient ingredient stock.
- Attempt to use inactive recipe.
- Attempt to edit completed batch.

### End-to-End Flow 2: Create waste log -> verify inventory reduction -> verify waste report
Preconditions:
- Store has available stock for the selected inventory item.
- Waste category exists.

Test steps:
1. Create a waste log for `Butter` with quantity `1` and category `Spoilage`.
2. Fetch waste log detail.
3. Fetch stock movements for `Butter`.
4. Fetch inventory on-hand for `Butter`.
5. Fetch waste report for the date range containing the waste log.

Expected result:
- One negative `WASTE` movement is created.
- On-hand quantity is reduced by the wasted amount.
- Waste report includes the new waste log and correct category totals.

Negative/edge case checks:
- Try wasting more than available stock.
- Try editing the created waste log.

### End-to-End Flow 3: Create reconciliation session -> enter actual counts -> post reconciliation -> verify INVENTORY_ADJUSTMENT movements -> verify variance report
Preconditions:
- Store has stock movement history.
- Choose a `startedAt` cut-off after known movements have occurred.

Test steps:
1. Create reconciliation session with `startedAt`.
2. Enter actual counts for at least two inventory items.
3. Post the reconciliation.
4. Fetch reconciliation detail.
5. Fetch inventory stock movements for the affected items.
6. Fetch reconciliation variance report for the range.

Expected result:
- Expected quantity is calculated from ledger movements where `occurredAt <= startedAt`.
- Variance is calculated correctly for each item.
- Only non-zero variance rows create `INVENTORY_ADJUSTMENT` movements.
- Session becomes `POSTED` and cannot be changed.
- Variance report reflects the posted adjustments.

Negative/edge case checks:
- Try editing after posting.
- Try posting a second time.
- Verify zero-variance items do not create adjustment movements.

### End-to-End Flow 4: Create order -> fulfill order -> create receipt -> verify SALE movement -> verify dashboard/report totals
Preconditions:
- Orders/Sales module and Receipt flow are available in the environment.
- Finished-good inventory exists for the store.
- Menu item resolves to a valid finished-good inventory item.

Test steps:
1. Create an order for `Chicken Pie`.
2. Verify no `SALE` movement is created at order creation.
3. Fulfill the order.
4. Fetch stock movements for the finished good.
5. Create one partial receipt.
6. Create a second receipt to complete payment.
7. Fetch order detail.
8. Fetch dashboard overview and sales report for the date range.

Expected result:
- Order creation creates order records only.
- Fulfillment creates negative `SALE` movement(s) using fulfillment timestamp.
- Finished-good inventory decreases only at fulfillment.
- Receipts are additive and can be multiple per order.
- Payment status updates as receipts accumulate.
- Dashboard/report totals reflect the sale and receipts as designed.

Negative/edge case checks:
- Try fulfilling with insufficient finished-good stock.
- Try fulfilling the same order twice.
- Try creating a receipt above the outstanding balance if overpayment is disallowed.

---

## Critical Edge Cases
- Cross-business access should always be rejected for store-scoped and business-scoped data.
- Ledger-derived inventory must remain correct when there are no movements, backdated movements, or mixed movement types.
- Posted inventory-affecting records must not expose update or delete paths.
- Reconciliation must use `occurredAt`, not `createdAt`, for expected balance calculations.
- Production completion must fail atomically if any ingredient is insufficient.
- Low-stock should not include items with null reorder level.
- Archived master data should not break historical operational records.
- Duplicate ingredient rows within a recipe should be rejected.
- Recipe activation must never leave two active recipes for one menu item.
- Sales should not reduce stock before fulfillment.
- Multiple receipts should correctly update payment status without mutating past receipts.
- Zero-variance reconciliation rows must not create adjustment movements.

---

## Suggested Seed Data Setup for Local Testing
1. Create one business and one store.
2. Create users for Owner, Inventory Manager, Production Manager, and Finance.
3. Create supplier `FreshFarm Supplies`.
4. Create waste categories `Spoilage` and `Damage`.
5. Create inventory items:
   - `Flour` raw material
   - `Butter` raw material
   - `Pie Pack` packaging
   - `Chicken Pie Batch` finished good
6. Create menu item `Chicken Pie`.
7. Create stock-in record:
   - Flour `50 kg`
   - Butter `10 kg`
   - Pie Pack `100 pcs`
8. Create recipe for `Chicken Pie` with:
   - Flour `5 kg`
   - Butter `2 kg`
   - Pie Pack `20 pcs`
   - Yield `20 pcs`
9. Activate the recipe.
10. Create and complete one production batch outputting `20 pcs`.
11. Create one waste log for `Butter` quantity `1 kg`.
12. Create one draft reconciliation and post with one positive and one negative variance.
13. If Orders/Sales module is available, create one order, fulfill it, and create two receipts.
14. Validate dashboard and reports over a date range that includes all seeded events.

## Acceptance Sign-Off Guidance
A module is ready for MVP acceptance when:
- Primary happy-path scenario passes.
- Immutability rules hold for posted inventory-affecting records.
- Ledger-derived balances remain correct after every operational action.
- Reports reflect the underlying operational records for the selected store and date range.
- Cross-business and invalid-status actions are rejected consistently.
