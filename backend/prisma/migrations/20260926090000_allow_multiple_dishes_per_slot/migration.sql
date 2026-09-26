-- Mehrere Gerichte pro Wochenplan-Slot (Issue #13)

-- DropIndex
DROP INDEX "MealSlot_mealPlanId_dayIndex_mealType_key";

-- AlterTable
ALTER TABLE "MealSlot" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "MealSlot_mealPlanId_dayIndex_mealType_position_idx" ON "MealSlot"("mealPlanId", "dayIndex", "mealType", "position");
