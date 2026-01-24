// Type definitions for i18n translations

export type Language = 'en' | 'de';

export interface Translations {
  // Common
  loading: string;
  error: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  back: string;
  close: string;
  search: string;
  or: string;
  
  // App Header
  app: {
    name: string;
    loggedInAs: string;
    admin: string;
    user: string;
    weeklyPlanner: string;
    downloadApp: string;
    administration: string;
    logout: string;
    loggedOutSuccess: string;
    language: string;
  };
  
  // Login
  login: {
    title: string;
    subtitle: string;
    username: string;
    password: string;
    loginButton: string;
    loggingIn: string;
    invalidCredentials: string;
    connectionError: string;
    googleError: string;
    twoFactorTitle: string;
    twoFactorDescription: string;
    twoFactorCode: string;
    verify: string;
    verifying: string;
    backToLogin: string;
    invalidCode: string;
  };
  
  // Recipes
  recipes: {
    myRecipes: string;
    searchPlaceholder: string;
    newRecipe: string;
    createFirst: string;
    noRecipes: string;
    noRecipesSearch: string;
    importRecipe: string;
    importSuccess: string;
    importError: string;
    recipeCreated: string;
    recipeUpdated: string;
    recipeDeleted: string;
    saveError: string;
    deleteError: string;
    loadError: string;
  };
  
  // Filters
  filters: {
    category: string;
    allCategories: string;
    collection: string;
    allCollections: string;
    resetFilters: string;
  };
  
  // Recipe Detail
  recipeDetail: {
    back: string;
    edit: string;
    delete: string;
    viewOriginal: string;
    preparation: string;
    restTime: string;
    cookTime: string;
    calories: string;
    ingredients: string;
    toShoppingList: string;
    servings: string;
    serving: string;
    originalRecipeFor: string;
    instructions: string;
    deleteConfirmTitle: string;
    deleteConfirmDescription: string;
    promptCopied: string;
    promptCopiedDescription: string;
    copyError: string;
    copyErrorDescription: string;
    image: string;
    min: string;
  };
  
  // Recipe Form
  recipeForm: {
    newRecipe: string;
    editRecipe: string;
    basicInfo: string;
    title: string;
    titlePlaceholder: string;
    images: string;
    uploadImages: string;
    categories: string;
    noCategories: string;
    timeInfo: string;
    prepTime: string;
    restTime: string;
    cookTime: string;
    totalTime: string;
    minutes: string;
    nutritionInfo: string;
    calories: string;
    weightUnit: string;
    weightUnitPlaceholder: string;
    ingredients: string;
    ingredientFor: string;
    ingredient: string;
    amount: string;
    addIngredient: string;
    instructions: string;
    instructionsPlaceholder: string;
    fileTooLarge: string;
    fileLoadError: string;
  };
  
  // Recipe Import
  recipeImport: {
    title: string;
    description: string;
    urlLabel: string;
    urlPlaceholder: string;
    importButton: string;
    importing: string;
    enterUrl: string;
  };
  
  // Collections
  collections: {
    title: string;
    addedToCollection: string;
    removedFromCollection: string;
    updateError: string;
  };
  
  // Weekly Planner
  planner: {
    title: string;
    description: string;
    back: string;
    thisWeek: string;
    nextWeek: string;
    calendarWeek: string;
    noMealsPlanned: string;
    addMealsHint: string;
    selectRecipe: string;
    recipe: string;
    aggregatedIngredients: string;
    newIngredients: string;
    alreadySent: string;
    restoreDeleted: string;
    resetSent: string;
    sendNewIngredients: string;
    sendAll: string;
    noIngredients: string;
    allSent: string;
    addRecipesFirst: string;
    ingredientsCopied: string;
    ingredientsSentTo: string;
    clickForDetails: string;
    usedIn: string;
    sentToGemini: string;
    planLoading: string;
    saveError: string;
    ingredientListError: string;
    sentReset: string;
    excludedReset: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    dayNames: string[];
    dayNamesShort: string[];
    noMeals: string;
    noMealsDescription: string;
    alreadySentGemini: string;
  };
  
  // Admin Panel
  admin: {
    title: string;
    systemSettings: string;
    profileSettings: string;
    backToRecipes: string;
    categories: string;
    collections: string;
    users: string;
    settings: string;
    security: string;
    geminiIntegration: string;
    geminiDescription: string;
    geminiPromptLabel: string;
    geminiPromptPlaceholder: string;
    geminiPromptHint: string;
    restoreDefault: string;
    promptSaved: string;
    promptSaveError: string;
    profile: string;
    accountInfo: string;
  };
  
  // Change Password
  password: {
    title: string;
    changeExisting: string;
    setNew: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    minLength: string;
    mismatch: string;
    changed: string;
    changeError: string;
    changeButton: string;
    setButton: string;
  };
  
  // Two-Factor Authentication
  twoFactor: {
    title: string;
    enabled: string;
    disabled: string;
    active: string;
    enable: string;
    disable: string;
    setupTitle: string;
    setupDescription: string;
    manualCode: string;
    enterCode: string;
    enableSuccess: string;
    disableSuccess: string;
    setupError: string;
    disableTitle: string;
    disableDescription: string;
    code: string;
  };
  
  // Category Manager
  categoryManager: {
    title: string;
    description: string;
    newCategory: string;
    placeholder: string;
    add: string;
    confirmDelete: string;
    confirmDeleteDescription: string;
    created: string;
    deleted: string;
    createError: string;
    deleteError: string;
    loadError: string;
    noCategories: string;
    recipesCount: string;
  };
  
  // Collection Manager
  collectionManager: {
    title: string;
    description: string;
    newCollection: string;
    placeholder: string;
    create: string;
    confirmDelete: string;
    confirmDeleteDescription: string;
    created: string;
    deleted: string;
    createError: string;
    deleteError: string;
    loadError: string;
    noCollections: string;
  };
  
  // User Manager
  userManager: {
    title: string;
    description: string;
    createUser: string;
    editUser: string;
    username: string;
    password: string;
    passwordPlaceholder: string;
    role: string;
    admin: string;
    user: string;
    you: string;
    confirmDelete: string;
    confirmDeleteDescription: string;
    created: string;
    updated: string;
    deleted: string;
    createError: string;
    updateError: string;
    deleteError: string;
    loadError: string;
    noUsers: string;
    validationError: string;
    has2FA: string;
    noPassword: string;
    hasPassword: string;
  };
  
  // Recipe Search Dialog
  recipeSearch: {
    title: string;
    searchPlaceholder: string;
    noResults: string;
    servings: string;
  };
}
