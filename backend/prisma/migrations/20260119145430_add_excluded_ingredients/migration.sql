-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN "excludedIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[];
