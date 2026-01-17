import { useState, useEffect } from 'react';
import type { Recipe } from '@/app/types/recipe';
import type { User } from '@/app/types/user';
import { RecipeList } from '@/app/components/RecipeList';
import { RecipeDetailWithCarousel } from '@/app/components/RecipeDetailWithCarousel';
import { RecipeForm } from '@/app/components/RecipeForm';
import { Login } from '@/app/components/Login';
import { AdminPanel } from '@/app/components/AdminPanel';
import { getRecipes, addRecipe, updateRecipe, deleteRecipe } from '@/app/utils/localStorage';
import { initializeAuth, getCurrentUser, logout } from '@/app/utils/auth';
import { Toaster } from '@/app/components/ui/sonner';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { LogOut, Settings } from 'lucide-react';

type View = 'list' | 'detail' | 'create' | 'edit' | 'admin';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Initialisiere Auth und lade Benutzer
  useEffect(() => {
    initializeAuth();
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  // Rezepte beim Start laden
  useEffect(() => {
    if (currentUser) {
      const loadedRecipes = getRecipes();
      setRecipes(loadedRecipes);

      // Beispielrezept hinzufügen, wenn keine Rezepte vorhanden sind
      if (loadedRecipes.length === 0) {
        const exampleRecipe: Recipe = {
          id: crypto.randomUUID(),
          title: 'Spaghetti Carbonara',
          images: ['https://images.unsplash.com/photo-1707322540604-f69bd7b2cb4c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXN0YSUyMGNhcmJvbmFyYSUyMGRpc2h8ZW58MXx8fHwxNzY4NTk4MTk1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'],
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
          categories: ['Hauptgericht'],
          userId: currentUser.id,
          createdAt: new Date().toISOString(),
        };
        addRecipe(exampleRecipe);
        setRecipes([exampleRecipe]);
      }
    }
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setCurrentView('list');
    toast.success('Erfolgreich abgemeldet');
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setCurrentView('detail');
  };

  const handleCreateNew = () => {
    setSelectedRecipe(null);
    setCurrentView('create');
  };

  const handleEdit = () => {
    setCurrentView('edit');
  };

  const handleSaveRecipe = (recipe: Recipe) => {
    if (currentView === 'create') {
      addRecipe(recipe);
      toast.success('Rezept erfolgreich erstellt!');
    } else {
      updateRecipe(recipe);
      toast.success('Rezept erfolgreich aktualisiert!');
    }
    setRecipes(getRecipes());
    setSelectedRecipe(recipe);
    setCurrentView('detail');
  };

  const handleDeleteRecipe = () => {
    if (selectedRecipe) {
      deleteRecipe(selectedRecipe.id);
      toast.success('Rezept erfolgreich gelöscht!');
      setRecipes(getRecipes());
      setSelectedRecipe(null);
      setCurrentView('list');
    }
  };

  const handleImportRecipe = (recipe: Recipe) => {
    addRecipe(recipe);
    setRecipes(getRecipes());
    setSelectedRecipe(recipe);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setSelectedRecipe(null);
    setCurrentView('list');
  };

  const handleOpenAdmin = () => {
    setCurrentView('admin');
  };

  const handleCloseAdmin = () => {
    setCurrentView('list');
  };

  // Zeige Login, wenn nicht angemeldet
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Rezeptverwaltung</h2>
            <p className="text-sm text-muted-foreground">
              Angemeldet als: {currentUser.username} ({currentUser.role === 'admin' ? 'Administrator' : 'Benutzer'})
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && currentView !== 'admin' && (
              <Button variant="outline" onClick={handleOpenAdmin}>
                <Settings className="h-4 w-4 mr-2" />
                Verwaltung
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {currentView === 'list' && (
          <RecipeList
            recipes={recipes}
            onSelectRecipe={handleSelectRecipe}
            onCreateNew={handleCreateNew}
            onImport={handleImportRecipe}
          />
        )}
        
        {currentView === 'detail' && selectedRecipe && (
          <RecipeDetailWithCarousel
            recipe={selectedRecipe}
            onClose={handleBackToList}
            onEdit={handleEdit}
            onDelete={handleDeleteRecipe}
          />
        )}
        
        {currentView === 'create' && currentUser && (
          <RecipeForm
            userId={currentUser.id}
            onSave={handleSaveRecipe}
            onCancel={handleBackToList}
          />
        )}
        
        {currentView === 'edit' && selectedRecipe && currentUser && (
          <RecipeForm
            recipe={selectedRecipe}
            userId={currentUser.id}
            onSave={handleSaveRecipe}
            onCancel={() => setCurrentView('detail')}
          />
        )}

        {currentView === 'admin' && isAdmin && (
          <AdminPanel
            currentUser={currentUser}
            onClose={handleCloseAdmin}
          />
        )}
      </main>
      
      <Toaster />
    </div>
  );
}
