import { useState, useEffect, useCallback } from 'react';
import type { Recipe } from '@/app/types/recipe';
import type { User } from '@/app/types/user';
import { RecipeList } from '@/app/components/RecipeList';
import { RecipeDetailWithCarousel } from '@/app/components/RecipeDetailWithCarousel';
import { RecipeForm } from '@/app/components/RecipeForm';
import { Login } from '@/app/components/Login';
import { AdminPanel } from '@/app/components/AdminPanel';
import { loadRecipes, addRecipe, updateRecipe, deleteRecipe } from '@/app/utils/localStorage';
import { initializeAuth, getCurrentUser, logout } from '@/app/utils/auth';
import { loadCategories } from '@/app/utils/categories';
import { Toaster } from '@/app/components/ui/sonner';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { LogOut, Settings, Loader2 } from 'lucide-react';

type View = 'list' | 'detail' | 'create' | 'edit' | 'admin';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialisiere Auth und lade Benutzer
  useEffect(() => {
    const init = async () => {
      try {
        const user = await initializeAuth();
        if (user) {
          setCurrentUser(user);
        } else {
          // Versuche aus localStorage zu laden (falls Token noch gültig)
          const storedUser = getCurrentUser();
          setCurrentUser(storedUser);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Rezepte laden wenn Benutzer angemeldet ist
  const fetchRecipes = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      const loadedRecipes = await loadRecipes();
      setRecipes(loadedRecipes);
      // Kategorien auch laden
      await loadCategories();
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast.error('Fehler beim Laden der Rezepte');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && isInitialized) {
      fetchRecipes();
    }
  }, [currentUser, isInitialized, fetchRecipes]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setRecipes([]);
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

  const handleSaveRecipe = async (recipe: Recipe) => {
    try {
      if (currentView === 'create') {
        const newRecipe = await addRecipe(recipe);
        toast.success('Rezept erfolgreich erstellt!');
        setSelectedRecipe(newRecipe);
      } else {
        const updatedRecipe = await updateRecipe(recipe);
        toast.success('Rezept erfolgreich aktualisiert!');
        setSelectedRecipe(updatedRecipe);
      }
      // Rezepte neu laden
      const loadedRecipes = await loadRecipes();
      setRecipes(loadedRecipes);
      setCurrentView('detail');
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Fehler beim Speichern des Rezepts');
    }
  };

  const handleDeleteRecipe = async () => {
    if (selectedRecipe) {
      try {
        await deleteRecipe(selectedRecipe.id);
        toast.success('Rezept erfolgreich gelöscht!');
        const loadedRecipes = await loadRecipes();
        setRecipes(loadedRecipes);
        setSelectedRecipe(null);
        setCurrentView('list');
      } catch (error) {
        console.error('Error deleting recipe:', error);
        toast.error('Fehler beim Löschen des Rezepts');
      }
    }
  };

  const handleImportRecipe = async (recipe: Recipe) => {
    try {
      const newRecipe = await addRecipe(recipe);
      const loadedRecipes = await loadRecipes();
      setRecipes(loadedRecipes);
      setSelectedRecipe(newRecipe);
      setCurrentView('detail');
      toast.success('Rezept erfolgreich importiert!');
    } catch (error) {
      console.error('Error importing recipe:', error);
      toast.error('Fehler beim Importieren des Rezepts');
    }
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

  // Zeige Loading während der Initialisierung
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Wird geladen...</p>
        </div>
      </div>
    );
  }

  // Zeige Login, wenn nicht angemeldet
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      {/* Header with background image */}
      <header 
        className="relative border-b overflow-hidden"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1495195134817-aeb325a55b65?w=1920&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/70" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">📖</div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">Cookbook</h1>
              <p className="text-sm text-white/80">
                Angemeldet als: {currentUser.username} ({currentUser.role === 'admin' ? 'Administrator' : 'Benutzer'})
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && currentView !== 'admin' && (
              <Button 
                variant="outline" 
                onClick={handleOpenAdmin}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
              >
                <Settings className="h-4 w-4 mr-2" />
                Verwaltung
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {isLoading && currentView === 'list' ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
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
          </>
        )}
      </main>
      
      <Toaster />
    </div>
  );
}
