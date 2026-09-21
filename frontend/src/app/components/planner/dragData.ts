import type { MealType } from '@/app/types/mealplan';

/** Nutzlast für natives Drag & Drop im Wochenplaner. */
export type PlannerDragData =
  | { kind: 'recipe'; recipeId: string }
  | { kind: 'slot'; dayIndex: number; mealType: MealType };

const MIME = 'application/x-cookbook-planner';

export function setDragData(event: React.DragEvent, data: PlannerDragData): void {
  event.dataTransfer.setData(MIME, JSON.stringify(data));
  event.dataTransfer.effectAllowed = 'move';
}

export function readDragData(event: React.DragEvent): PlannerDragData | null {
  try {
    const raw = event.dataTransfer.getData(MIME);
    return raw ? (JSON.parse(raw) as PlannerDragData) : null;
  } catch {
    return null;
  }
}

export function hasDragData(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(MIME);
}

export function slotKey(dayIndex: number, mealType: MealType): string {
  return `${dayIndex}:${mealType}`;
}
