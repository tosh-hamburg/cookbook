-- AlterTable
ALTER TABLE "MealPlan" ALTER COLUMN "excludedIngredients" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "notes" TEXT;
