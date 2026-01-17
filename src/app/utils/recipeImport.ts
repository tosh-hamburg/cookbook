import type { Recipe } from '@/app/types/recipe';

// Mock-Funktion für den Rezept-Import
// In einer echten Implementierung würde dies eine Backend-API aufrufen
export const importRecipeFromUrl = async (url: string): Promise<Recipe> => {
  // Simuliere API-Aufruf
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Mock-Daten basierend auf der URL
  const mockRecipes: Record<string, Partial<Recipe>> = {
    'chefkoch.de': {
      title: 'Spaghetti Carbonara',
      ingredients: [
        { name: 'Spaghetti', amount: '500g' },
        { name: 'Eier', amount: '4 Stück' },
        { name: 'Parmesan', amount: '100g' },
        { name: 'Speck', amount: '150g' },
        { name: 'Pfeffer', amount: 'nach Geschmack' },
      ],
      instructions: `1. Die Spaghetti in einem großen Topf mit Salzwasser nach Packungsanweisung al dente kochen.

2. Währenddessen den Speck in kleine Würfel schneiden und in einer Pfanne knusprig braten.

3. In einer Schüssel die Eier mit dem geriebenen Parmesan verquirlen und großzügig mit Pfeffer würzen.

4. Die Spaghetti abgießen, dabei etwas Nudelwasser auffangen. Die heißen Spaghetti mit dem Speck vermischen.

5. Den Topf vom Herd nehmen und die Ei-Käse-Mischung unter ständigem Rühren zu den Spaghetti geben. Falls nötig, etwas Nudelwasser hinzufügen, um eine cremige Konsistenz zu erhalten.

6. Sofort servieren und mit zusätzlichem Parmesan und Pfeffer garnieren.`,
      prepTime: 10,
      restTime: 0,
      cookTime: 15,
      totalTime: 25,
      caloriesPerUnit: 450,
      weightUnit: '100g',
    },
    'default': {
      title: 'Importiertes Rezept',
      ingredients: [
        { name: 'Zutat 1', amount: '200g' },
        { name: 'Zutat 2', amount: '3 Stück' },
      ],
      instructions: 'Dies ist ein Beispielrezept, das von der URL importiert wurde. In einer echten Implementierung würden hier die tatsächlichen Rezeptdaten von der Website extrahiert werden.',
      prepTime: 15,
      restTime: 30,
      cookTime: 45,
      totalTime: 90,
      caloriesPerUnit: 250,
      weightUnit: '100g',
    },
  };

  // Wähle Mock-Daten basierend auf der URL
  const mockData = url.includes('chefkoch.de') 
    ? mockRecipes['chefkoch.de']
    : mockRecipes['default'];

  return {
    id: crypto.randomUUID(),
    images: [],
    createdAt: new Date().toISOString(),
    ...mockData,
  } as Recipe;
};
