import { useState, useEffect, useCallback } from 'react';
import type { Recipe } from '@/app/types/recipe';
import type { User } from '@/app/types/user';
import { AppHeader, type NavTarget } from '@/app/components/AppHeader';
import { RecipeList } from '@/app/components/RecipeList';
import { RecipeDetail } from '@/app/components/RecipeDetail';
import { RecipeForm } from '@/app/components/RecipeForm';
import { CookMode } from '@/app/components/CookMode';
import { Login } from '@/app/components/Login';
import { AdminPanel } from '@/app/components/AdminPanel';
import { WeeklyPlanner } from '@/app/components/WeeklyPlanner';
import { AddToWeekPlannerDialog } from '@/app/components/AddToWeekPlannerDialog';
import { RecipeImportDialog } from '@/app/components/RecipeImportDialog';
import { getCurrentWeekStart } from '@/app/types/mealplan';
import { loadRecipes, addRecipe, updateRecipe, deleteRecipe } from '@/app/utils/localStorage';
import { initializeAuth, getCurrentUser, logout } from '@/app/utils/auth';
import { loadCategories } from '@/app/utils/categories';
import { useWeekPlan } from '@/app/hooks/useWeekPlan';
import { Toaster } from '@/app/components/ui/sonner';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { recipesApi, settingsApi } from '@/app/services/api';
import { useTranslation } from '@/app/i18n';

type View = 'list' | 'detail' | 'cook' | 'create' | 'edit' | 'admin' | 'planner';

// Views that make sense to restore after reload
const RESTORABLE_VIEWS: View[] = ['list', 'detail', 'admin', 'planner'];

function getSavedView(): View {
  const saved = sessionStorage.getItem('currentView') as View | null;
  return saved && RESTORABLE_VIEWS.includes(saved) ? saved : 'list';
}

interface CookSession {
  recipe: Recipe;
  servings: number;
}

export default function App() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentView, setCurrentView] = useState<View>(getSavedView);
  const [previousView, setPreviousView] = useState<View>('list');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [cookSession, setCookSession] = useState<CookSession | null>(null);
  const [planRecipe, setPlanRecipe] = useState<Recipe | null>(null);
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [geminiPrompt, setGeminiPrompt] = useState<string>('');

  // Weekly planner state (persisted across view changes)
  const [plannerWeekStart, setPlannerWeekStart] = useState<Date>(() => getCurrentWeekStart());
  const [excludedIngredients, setExcludedIngredients] = useState<Set<string>>(new Set());
  const [sentIngredients, setSentIngredients] = useState<Set<string>>(new Set());
  const [shoppingListOpen, setShoppingListOpen] = useState(false);

  // Current week for the band on the library page; a fresh Date object forces a reload
  const [bandWeekStart, setBandWeekStart] = useState<Date>(() => getCurrentWeekStart());
  const { weekPlan: bandWeekPlan } = useWeekPlan(bandWeekStart, recipes, { enabled: !!currentUser });

  // Persist current view and selected recipe ID to sessionStorage
  useEffect(() => {
    if (RESTORABLE_VIEWS.includes(currentView)) {
      sessionStorage.setItem('currentView', currentView);
    }
  }, [currentView]);

  useEffect(() => {
    if (selectedRecipe) {
      sessionStorage.setItem('selectedRecipeId', selectedRecipe.id);
    } else {
      sessionStorage.removeItem('selectedRecipeId');
    }
  }, [selectedRecipe]);

  // Restore selected recipe after recipes are loaded
  useEffect(() => {
    if (recipes.length > 0 && currentView === 'detail' && !selectedRecipe) {
      const savedId = sessionStorage.getItem('selectedRecipeId');
      const found = savedId ? recipes.find((r) => r.id === savedId) : undefined;
      if (found) {
        setSelectedRecipe(found);
      } else {
        setCurrentView('list');
      }
    }
  }, [recipes, currentView, selectedRecipe]);

  // Keep the selected recipe in sync with the list (favorite, cook counter, edits)
  useEffect(() => {
    if (!selectedRecipe) return;
    const fresh = recipes.find((r) => r.id === selectedRecipe.id);
    if (fresh && fresh !== selectedRecipe) setSelectedRecipe(fresh);
  }, [recipes, selectedRecipe]);

  // Initialisiere Auth und lade Benutzer
  useEffect(() => {
    const init = async () => {
      try {
        const user = await initializeAuth();
        setCurrentUser(user ?? getCurrentUser());
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
      setRecipes(await loadRecipes());
      await loadCategories();
      try {
        const settings = await settingsApi.getGeminiPrompt();
        if (settings.geminiPrompt) setGeminiPrompt(settings.geminiPrompt);
      } catch {
        // Wenn keine Einstellungen vorhanden, Standard-Prompt verwenden
      }
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast.error(t.recipes.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && isInitialized) {
      fetchRecipes();
    }
  }, [currentUser, isInitialized, fetchRecipes]);

  const replaceRecipe = (updated: Recipe) =>
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  const handleLogin = (user: User) => setCurrentUser(user);

  const handleLogout = () => {
    logout();
    sessionStorage.removeItem('currentView');
    sessionStorage.removeItem('selectedRecipeId');
    setCurrentUser(null);
    setRecipes([]);
    setCurrentView('list');
    toast.success(t.app.loggedOutSuccess);
  };

  const showList = () => {
    setSelectedRecipe(null);
    setBandWeekStart(getCurrentWeekStart());
    setCurrentView('list');
  };

  const handleSelectRecipe = (recipe: Recipe, fromView?: View) => {
    setSelectedRecipe(recipe);
    setPreviousView(fromView || currentView);
    setCurrentView('detail');
  };

  const handleCreateNew = () => {
    setSelectedRecipe(null);
    setCurrentView('create');
  };

  const handleSaveRecipe = async (recipe: Recipe) => {
    try {
      if (currentView === 'create') {
        setSelectedRecipe(await addRecipe(recipe));
        toast.success(t.recipes.recipeCreated);
      } else {
        setSelectedRecipe(await updateRecipe(recipe));
        toast.success(t.recipes.recipeUpdated);
      }
      setRecipes(await loadRecipes());
      setCurrentView('detail');
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error(t.recipes.saveError);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe) return;
    try {
      await deleteRecipe(selectedRecipe.id);
      toast.success(t.recipes.recipeDeleted);
      setRecipes(await loadRecipes());
      showList();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error(t.recipes.deleteError);
    }
  };

  const handleImportRecipe = async (recipe: Recipe) => {
    try {
      const newRecipe = await addRecipe(recipe);
      setRecipes(await loadRecipes());
      setSelectedRecipe(newRecipe);
      setCurrentView('detail');
      toast.success(t.recipes.importSuccess);
    } catch (error) {
      console.error('Error importing recipe:', error);
      toast.error(t.recipes.importError);
    }
  };

  const handleBackToList = () => {
    if (previousView === 'planner') {
      setCurrentView('planner');
    } else {
      showList();
    }
  };

  // Herz: optimistisch umschalten, bei Fehler zurücknehmen
  const handleToggleFavorite = async (recipe: Recipe) => {
    const next = !recipe.isFavorite;
    replaceRecipe({ ...recipe, isFavorite: next });
    try {
      await recipesApi.setFavorite(recipe.id, next);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      replaceRecipe({ ...recipe, isFavorite: !next });
      toast.error(t.kitchen.detail.favoriteError);
    }
  };

  const startCooking = (recipe: Recipe, servings?: number) => {
    setCookSession({ recipe, servings: servings ?? recipe.servings ?? 1 });
    setCurrentView('cook');
  };

  const exitCooking = () => {
    setCookSession(null);
    if (selectedRecipe) setCurrentView('detail');
    else showList();
  };

  // „Fertig" im Kochmodus: Kochzähler +1 (Backend), dann zurück ins Rezept
  const finishCooking = async (recipe: Recipe, servings: number) => {
    try {
      const stats = await recipesApi.recordCooked(recipe.id, servings);
      replaceRecipe({ ...recipe, ...stats });
      toast.success(t.kitchen.cook.cookedRecorded);
    } catch (error) {
      console.error('Error recording cook event:', error);
      toast.error(t.kitchen.cook.cookedRecordError);
    }
    setCookSession(null);
    setSelectedRecipe(recipe);
    setCurrentView('detail');
  };

  const openPlanner = (withShoppingList = false) => {
    setPreviousView(currentView);
    setShoppingListOpen(withShoppingList);
    setCurrentView('planner');
  };

  const handleNavigate = (target: NavTarget) => {
    if (target === 'recipes') showList();
    else openPlanner(target === 'shopping');
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (currentView !== 'list' && value.trim()) showList();
  };

  const activeNav: NavTarget | null =
    currentView === 'planner' ? (shoppingListOpen ? 'shopping' : 'planner') : currentView === 'admin' ? null : 'recipes';

  // Zeige Loading während der Initialisierung
  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-tomato" />
          <p className="text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdmin = currentUser.role === 'admin';

  if (currentView === 'cook' && cookSession) {
    return (
      <>
        <CookMode
          recipe={cookSession.recipe}
          servings={cookSession.servings}
          onExit={exitCooking}
          onFinish={finishCooking}
        />
        <Toaster />
      </>
    );
  }

  return (
    <div className="paper-dots min-h-screen bg-background">
      <AppHeader
        user={currentUser}
        active={activeNav}
        query={query}
        onQueryChange={handleQueryChange}
        onNavigate={handleNavigate}
        onCreateNew={handleCreateNew}
        onImport={() => setImportOpen(true)}
        onOpenAdmin={() => setCurrentView('admin')}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-[1420px] px-10 pb-[60px] pt-[34px] max-[900px]:px-4 max-[900px]:pt-5">
        {isLoading && (currentView === 'list' || (currentView === 'detail' && !selectedRecipe)) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-tomato" />
          </div>
        ) : (
          <>
            {currentView === 'list' && (
              <RecipeList
                recipes={recipes}
                query={query}
                weekPlan={bandWeekPlan}
                onSelectRecipe={handleSelectRecipe}
                onCreateNew={handleCreateNew}
                onOpenImport={() => setImportOpen(true)}
                onCook={(recipe) => startCooking(recipe)}
                onPlan={setPlanRecipe}
                onToggleFavorite={handleToggleFavorite}
                onOpenPlanner={() => openPlanner(false)}
                onCreateShoppingList={() => openPlanner(true)}
              />
            )}

            {currentView === 'detail' && selectedRecipe && (
              <RecipeDetail
                recipe={selectedRecipe}
                onClose={handleBackToList}
                onEdit={() => setCurrentView('edit')}
                onDelete={handleDeleteRecipe}
                onCook={startCooking}
                onToggleFavorite={handleToggleFavorite}
                isAdmin={isAdmin}
                onRecipeUpdate={(updated) => {
                  setSelectedRecipe(updated);
                  replaceRecipe(updated);
                }}
              />
            )}

            {currentView === 'create' && (
              <RecipeForm userId={currentUser.id} onSave={handleSaveRecipe} onCancel={handleBackToList} />
            )}

            {currentView === 'edit' && selectedRecipe && (
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
                onClose={showList}
                onSettingsUpdate={async () => {
                  try {
                    const settings = await settingsApi.getGeminiPrompt();
                    if (settings.geminiPrompt) setGeminiPrompt(settings.geminiPrompt);
                  } catch {
                    // Ignore errors
                  }
                }}
              />
            )}

            {currentView === 'planner' && (
              <WeeklyPlanner
                recipes={recipes}
                onViewRecipe={(recipe) => handleSelectRecipe(recipe, 'planner')}
                geminiPrompt={geminiPrompt}
                excludedIngredients={excludedIngredients}
                onExcludedIngredientsChange={setExcludedIngredients}
                currentWeekStart={plannerWeekStart}
                onWeekStartChange={setPlannerWeekStart}
                sentIngredients={sentIngredients}
                onSentIngredientsChange={setSentIngredients}
                shoppingListOpen={shoppingListOpen}
                onShoppingListOpenChange={setShoppingListOpen}
              />
            )}
          </>
        )}
      </main>

      {planRecipe && (
        <AddToWeekPlannerDialog
          recipe={planRecipe}
          open
          onOpenChange={(open) => {
            if (!open) setPlanRecipe(null);
          }}
          onSuccess={() => {
            setBandWeekStart(getCurrentWeekStart());
            toast.success(t.planner.recipeAdded);
          }}
        />
      )}

      <RecipeImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImportRecipe} />

      <Toaster />
    </div>
  );
}
