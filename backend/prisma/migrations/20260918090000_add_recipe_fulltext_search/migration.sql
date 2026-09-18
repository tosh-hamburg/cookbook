-- Volltextsuche ueber Rezepte (Issue #10).
--
-- "Recipe"."searchVector" fasst Titel, Kategorien, Zutaten, Notizen und
-- Anleitung eines Rezepts als tsvector zusammen (Konfiguration 'german',
-- Gewichte A..D fuer die Rangfolge). Die Spalte wird per Trigger gepflegt,
-- weil Zutaten und Kategorien in eigenen Tabellen liegen und eine generierte
-- Spalte deshalb nicht ausreicht. Prisma kennt die Spalte nur als
-- Unsupported("tsvector") und schreibt sie nie selbst.

ALTER TABLE "Recipe" ADD COLUMN "searchVector" tsvector;

CREATE INDEX "Recipe_searchVector_idx" ON "Recipe" USING GIN ("searchVector");

-- Berechnet den Suchvektor eines Rezepts aus allen beteiligten Tabellen.
CREATE FUNCTION recipe_search_vector(recipe_row "Recipe") RETURNS tsvector
LANGUAGE sql STABLE AS $$
  SELECT setweight(to_tsvector('german', recipe_row.title), 'A')
      || setweight(to_tsvector('german', coalesce((
           SELECT string_agg(c.name, ' ')
           FROM "RecipeCategory" rc
           JOIN "Category" c ON c.id = rc."categoryId"
           WHERE rc."recipeId" = recipe_row.id
         ), '')), 'B')
      || setweight(to_tsvector('german', coalesce((
           SELECT string_agg(i.name, ' ')
           FROM "Ingredient" i
           WHERE i."recipeId" = recipe_row.id
         ), '')), 'B')
      || setweight(to_tsvector('german', coalesce(recipe_row.notes, '')), 'C')
      || setweight(to_tsvector('german', recipe_row.instructions), 'D');
$$;

-- Schreibt den Suchvektor eines Rezepts neu (fuer Aenderungen an Nebentabellen).
CREATE FUNCTION recipe_search_refresh(target_id text) RETURNS void
LANGUAGE sql AS $$
  UPDATE "Recipe" r SET "searchVector" = recipe_search_vector(r) WHERE r.id = target_id;
$$;

-- Rezept selbst: Titel, Anleitung oder Notizen geaendert.
-- Nur auf diese Spalten beschraenkt, damit recipe_search_refresh() keinen
-- zweiten Durchlauf ausloest.
CREATE FUNCTION recipe_search_on_recipe() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchVector" := recipe_search_vector(NEW);
  RETURN NEW;
END
$$;

CREATE TRIGGER recipe_search_on_recipe
  BEFORE INSERT OR UPDATE OF title, instructions, notes ON "Recipe"
  FOR EACH ROW EXECUTE FUNCTION recipe_search_on_recipe();

-- Zutaten und Kategoriezuordnungen: betroffenes Rezept neu berechnen.
CREATE FUNCTION recipe_search_on_child() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM recipe_search_refresh(OLD."recipeId");
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM recipe_search_refresh(NEW."recipeId");
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER recipe_search_on_ingredient
  AFTER INSERT OR UPDATE OR DELETE ON "Ingredient"
  FOR EACH ROW EXECUTE FUNCTION recipe_search_on_child();

CREATE TRIGGER recipe_search_on_recipe_category
  AFTER INSERT OR UPDATE OR DELETE ON "RecipeCategory"
  FOR EACH ROW EXECUTE FUNCTION recipe_search_on_child();

-- Kategorie umbenannt: alle Rezepte dieser Kategorie neu berechnen.
CREATE FUNCTION recipe_search_on_category() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Recipe" r SET "searchVector" = recipe_search_vector(r)
  WHERE r.id IN (SELECT "recipeId" FROM "RecipeCategory" WHERE "categoryId" = NEW.id);
  RETURN NULL;
END
$$;

CREATE TRIGGER recipe_search_on_category
  AFTER UPDATE OF name ON "Category"
  FOR EACH ROW EXECUTE FUNCTION recipe_search_on_category();

-- Bestehende Rezepte einmalig befuellen.
UPDATE "Recipe" r SET "searchVector" = recipe_search_vector(r);
