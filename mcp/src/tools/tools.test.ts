import { beforeEach, describe, expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CookbookApiClient } from '../api/client.js';
import { createMcpServer } from '../server.js';
import { staticClientResolver } from '../client-resolver.js';
import { createFetchStub, makeApiOptions, makeRecipe, type RecordedCall, type StubHandler } from '../test-utils.js';

/**
 * Integrationstests über das echte MCP-Protokoll: ein In-Memory-Client spricht
 * mit dem echten Server, nur die Kochbuch-API ist durch ein fetch-Double ersetzt.
 */
async function connect(handler: StubHandler): Promise<{ client: Client; calls: RecordedCall[] }> {
  const { fetch, calls } = createFetchStub(handler);
  const server = createMcpServer(staticClientResolver(new CookbookApiClient(makeApiOptions(), fetch)));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });

  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, calls };
}

function textOf(result: CallToolResult): string {
  return result.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
}

function jsonOf(result: CallToolResult): Record<string, unknown> {
  return JSON.parse(textOf(result)) as Record<string, unknown>;
}

describe('Werkzeug-Katalog', () => {
  test('meldet alle Kochbuch-Werkzeuge', async () => {
    const { client } = await connect(() => ({ body: {} }));

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_recipe_to_collection',
      'create_recipe',
      'delete_recipe',
      'get_recipe',
      'import_recipe_from_url',
      'list_categories',
      'list_collections',
      'list_recipes',
      'remove_recipe_from_collection',
      'update_recipe',
    ]);
  });

  test('kennzeichnet lesende und löschende Werkzeuge', async () => {
    const { client } = await connect(() => ({ body: {} }));

    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

    expect(byName.list_recipes.annotations?.readOnlyHint).toBe(true);
    expect(byName.delete_recipe.annotations?.destructiveHint).toBe(true);
    expect(byName.create_recipe.annotations?.readOnlyHint).toBe(false);
  });
});

describe('list_recipes', () => {
  test('liefert eine kompakte Liste ohne Thumbnail-Daten', async () => {
    const thumbnail = `data:image/jpeg;base64,${'A'.repeat(5000)}`;
    const { client, calls } = await connect(() => ({
      body: {
        items: [
          {
            id: 'r-1',
            title: 'Suppe',
            thumbnail,
            prepTime: 5,
            cookTime: 10,
            totalTime: 15,
            servings: 2,
            categories: ['Vorspeise'],
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
      },
    }));

    const result = (await client.callTool({ name: 'list_recipes', arguments: { search: 'Suppe' } })) as CallToolResult;

    expect(textOf(result)).not.toContain('AAAA');
    expect(jsonOf(result)).toMatchObject({ total: 1, items: [{ id: 'r-1', hasImage: true }] });
    expect(calls[0].url.searchParams.get('search')).toBe('Suppe');
  });

  test('setzt Vorgabewerte für Seitengröße und Versatz', async () => {
    const { client, calls } = await connect(() => ({ body: { items: [], total: 0, hasMore: false } }));

    await client.callTool({ name: 'list_recipes', arguments: {} });

    expect(calls[0].url.searchParams.get('limit')).toBe('20');
    expect(calls[0].url.searchParams.get('offset')).toBe('0');
  });

  test('verbindet mehrere Sammlungs-IDs zu einem Parameter', async () => {
    const { client, calls } = await connect(() => ({ body: { items: [], total: 0, hasMore: false } }));

    await client.callTool({ name: 'list_recipes', arguments: { collectionIds: ['c-1', 'c-2'] } });

    expect(calls[0].url.searchParams.get('collections')).toBe('c-1,c-2');
  });
});

describe('get_recipe', () => {
  test('liefert das Rezept ohne Bilddaten', async () => {
    const blob = 'A'.repeat(20_000);
    const { client } = await connect(() => ({ body: makeRecipe({ images: [`data:image/png;base64,${blob}`] }) }));

    const result = (await client.callTool({ name: 'get_recipe', arguments: { id: 'r-1' } })) as CallToolResult;

    expect(textOf(result)).not.toContain(blob);
    expect(jsonOf(result)).toMatchObject({
      title: 'Linsensuppe',
      images: [{ kind: 'base64', value: 'image/png' }],
    });
  });

  test('meldet ein unbekanntes Rezept als Fehler im Ergebnis', async () => {
    const { client } = await connect(() => ({ status: 404, body: { error: 'Rezept nicht gefunden' } }));

    const result = (await client.callTool({ name: 'get_recipe', arguments: { id: 'weg' } })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Nicht gefunden/);
  });
});

describe('create_recipe', () => {
  test('legt ein Rezept mit den Vorgabewerten an', async () => {
    const { client, calls } = await connect(() => ({ status: 201, body: makeRecipe() }));

    const result = (await client.callTool({
      name: 'create_recipe',
      arguments: { title: 'Pfannkuchen', instructions: 'Teig rühren.' },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toMatchObject({
      title: 'Pfannkuchen',
      instructions: 'Teig rühren.',
      servings: 4,
      weightUnit: 'Portion',
      ingredients: [],
      categories: [],
      images: [],
      totalTime: 0,
      sourceUrl: null,
      notes: null,
    });
  });

  test('berechnet die Gesamtzeit aus den Teilzeiten', async () => {
    const { client, calls } = await connect(() => ({ status: 201, body: makeRecipe() }));

    await client.callTool({
      name: 'create_recipe',
      arguments: { title: 'Brot', instructions: 'Backen.', prepTime: 20, restTime: 90, cookTime: 40 },
    });

    expect(calls[0].body).toMatchObject({ totalTime: 150 });
  });

  test('lehnt ein Rezept ohne Titel ab, ohne die API aufzurufen', async () => {
    const { client, calls } = await connect(() => ({ status: 201, body: makeRecipe() }));

    const result = (await client.callTool({
      name: 'create_recipe',
      arguments: { instructions: 'Nur Text' },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/title/);
    expect(calls).toHaveLength(0);
  });

  test('lehnt ein einzelnes zu großes Bild ab, bevor es die API erreicht', async () => {
    const { client, calls } = await connect(() => ({ status: 201, body: makeRecipe() }));
    const riesig = `data:image/png;base64,${'A'.repeat(2_000_001)}`;

    const result = (await client.callTool({
      name: 'create_recipe',
      arguments: { title: 'X', instructions: 'Y', images: [riesig] },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test('lehnt Bilder ab, die zusammen zu groß sind', async () => {
    const { client, calls } = await connect(() => ({ status: 201, body: makeRecipe() }));
    const gross = `data:image/png;base64,${'A'.repeat(1_600_000)}`;

    const result = (await client.callTool({
      name: 'create_recipe',
      arguments: { title: 'X', instructions: 'Y', images: [gross, gross] },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/zusammen zu groß/);
    expect(calls).toHaveLength(0);
  });

  test('lehnt Bilder ab, die weder URL noch Data-URL sind', async () => {
    const { client, calls } = await connect(() => ({ status: 201, body: makeRecipe() }));

    const result = (await client.callTool({
      name: 'create_recipe',
      arguments: { title: 'X', instructions: 'Y', images: ['/etc/passwd'] },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/http\(s\)-URL/);
    expect(calls).toHaveLength(0);
  });
});

describe('update_recipe', () => {
  let sent: unknown;

  beforeEach(() => {
    sent = undefined;
  });

  async function connectForUpdate(current = makeRecipe()) {
    return connect((call) => {
      if (call.method === 'PUT') {
        sent = call.body;
        return { body: { ...current, ...(call.body as object) } };
      }
      return { body: current };
    });
  }

  test('liest den aktuellen Stand und sendet den vollständigen Datensatz', async () => {
    const { client, calls } = await connectForUpdate();

    const result = (await client.callTool({
      name: 'update_recipe',
      arguments: { id: 'r-1', title: 'Neuer Titel' },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(calls.map((c) => c.method)).toEqual(['GET', 'PUT']);
    // Entscheidend: Zutaten und Kategorien werden mitgesendet, sonst löscht sie das Backend.
    expect(sent).toMatchObject({
      title: 'Neuer Titel',
      ingredients: [
        { name: 'Linsen', amount: '250 g' },
        { name: 'Karotten', amount: '2 Stück' },
      ],
      categories: ['Hauptgericht'],
      instructions: 'Alles kochen.',
    });
  });

  test('ersetzt die Zutatenliste, wenn sie angegeben ist', async () => {
    const { client } = await connectForUpdate();

    await client.callTool({
      name: 'update_recipe',
      arguments: { id: 'r-1', ingredients: [{ name: 'Bohnen', amount: '400 g' }] },
    });

    expect(sent).toMatchObject({ ingredients: [{ name: 'Bohnen', amount: '400 g' }] });
  });

  test('berechnet die Gesamtzeit neu, wenn sich eine Teilzeit ändert', async () => {
    const { client } = await connectForUpdate();

    await client.callTool({ name: 'update_recipe', arguments: { id: 'r-1', cookTime: 30 } });

    expect(sent).toMatchObject({ cookTime: 30, totalTime: 45 });
  });

  test('meldet fehlende Berechtigung verständlich', async () => {
    const { client } = await connect((call) =>
      call.method === 'PUT'
        ? { status: 403, body: { error: 'Keine Berechtigung zum Bearbeiten' } }
        : { body: makeRecipe() },
    );

    const result = (await client.callTool({
      name: 'update_recipe',
      arguments: { id: 'r-1', title: 'X' },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Keine Berechtigung/);
  });
});

describe('delete_recipe', () => {
  test('löscht nach ausdrücklicher Bestätigung und nennt den Titel', async () => {
    const { client, calls } = await connect((call) =>
      call.method === 'DELETE' ? { body: { message: 'Rezept gelöscht' } } : { body: makeRecipe() },
    );

    const result = (await client.callTool({
      name: 'delete_recipe',
      arguments: { id: 'r-1', confirm: true },
    })) as CallToolResult;

    expect(textOf(result)).toContain('Linsensuppe');
    expect(calls.map((c) => c.method)).toEqual(['GET', 'DELETE']);
  });

  test('löscht nicht ohne Bestätigung', async () => {
    const { client, calls } = await connect(() => ({ body: makeRecipe() }));

    const result = (await client.callTool({ name: 'delete_recipe', arguments: { id: 'r-1' } })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test('löscht nicht bei confirm: false', async () => {
    const { client, calls } = await connect(() => ({ body: makeRecipe() }));

    const result = (await client.callTool({
      name: 'delete_recipe',
      arguments: { id: 'r-1', confirm: false },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/confirm/);
    expect(calls).toHaveLength(0);
  });
});

describe('Katalog-Werkzeuge', () => {
  test('list_categories liefert die Kategorien', async () => {
    const { client } = await connect(() => ({ body: [{ id: 'c-1', name: 'Dessert' }] }));

    const result = (await client.callTool({ name: 'list_categories', arguments: {} })) as CallToolResult;

    expect(JSON.parse(textOf(result))).toEqual([{ id: 'c-1', name: 'Dessert' }]);
  });

  test('list_collections liefert die Sammlungen', async () => {
    const { client } = await connect(() => ({ body: [{ id: 's-1', name: 'Weihnachten', description: null }] }));

    const result = (await client.callTool({ name: 'list_collections', arguments: {} })) as CallToolResult;

    expect(JSON.parse(textOf(result))).toEqual([{ id: 's-1', name: 'Weihnachten', description: null }]);
  });

  test('add_recipe_to_collection ruft den richtigen Endpunkt auf', async () => {
    const { client, calls } = await connect(() => ({ body: {} }));

    await client.callTool({ name: 'add_recipe_to_collection', arguments: { collectionId: 's-1', recipeId: 'r-1' } });

    expect(calls[0].url.pathname).toBe('/api/collections/s-1/recipes/r-1');
    expect(calls[0].method).toBe('POST');
  });

  test('meldet fehlende Admin-Rechte verständlich', async () => {
    const { client } = await connect(() => ({ status: 403, body: { error: 'Admin-Rechte erforderlich' } }));

    const result = (await client.callTool({
      name: 'remove_recipe_from_collection',
      arguments: { collectionId: 's-1', recipeId: 'r-1' },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Admin-Rechte erforderlich/);
  });
});

describe('import_recipe_from_url', () => {
  const scraped = {
    title: 'Importierte Suppe',
    images: [`data:image/jpeg;base64,${'A'.repeat(4000)}`],
    ingredients: [{ name: 'Wasser', amount: '1 l' }],
    instructions: 'Kochen.',
    prepTime: 5,
    restTime: 0,
    cookTime: 25,
    totalTime: 30,
    servings: 4,
    caloriesPerUnit: 100,
    weightUnit: 'Portion',
    categories: ['Vorspeise'],
    sourceUrl: 'https://example.test/rezept',
  };

  test('speichert standardmäßig direkt und behält dabei die Bilder', async () => {
    const { client, calls } = await connect((call) =>
      call.url.pathname === '/api/import' ? { body: scraped } : { status: 201, body: makeRecipe() },
    );

    const result = (await client.callTool({
      name: 'import_recipe_from_url',
      arguments: { url: 'https://example.test/rezept' },
    })) as CallToolResult;

    expect(jsonOf(result)).toMatchObject({ saved: true });
    expect(calls.map((c) => c.url.pathname)).toEqual(['/api/import', '/api/recipes']);
    expect((calls[1].body as { images: string[] }).images).toHaveLength(1);
    // Die Bilddaten gehen an die API, aber nicht zurück ins Gespräch.
    expect(textOf(result)).not.toContain('AAAA');
  });

  test('liefert mit save: false nur eine Vorschau ohne zu speichern', async () => {
    const { client, calls } = await connect(() => ({ body: scraped }));

    const result = (await client.callTool({
      name: 'import_recipe_from_url',
      arguments: { url: 'https://example.test/rezept', save: false },
    })) as CallToolResult;

    expect(jsonOf(result)).toMatchObject({ saved: false });
    expect(calls).toHaveLength(1);
    expect(textOf(result)).not.toContain('AAAA');
  });

  test('übernimmt Überschreibungen für Titel, Kategorien und Notiz', async () => {
    const { client, calls } = await connect((call) =>
      call.url.pathname === '/api/import' ? { body: scraped } : { status: 201, body: makeRecipe() },
    );

    await client.callTool({
      name: 'import_recipe_from_url',
      arguments: {
        url: 'https://example.test/rezept',
        title: 'Eigener Titel',
        categories: ['Hauptgericht'],
        notes: 'Nachgekocht am Sonntag',
      },
    });

    expect(calls[1].body).toMatchObject({
      title: 'Eigener Titel',
      categories: ['Hauptgericht'],
      notes: 'Nachgekocht am Sonntag',
    });
  });

  test('ruft interne Adressen gar nicht erst ab', async () => {
    const { client, calls } = await connect(() => ({ body: scraped }));

    const result = (await client.callTool({
      name: 'import_recipe_from_url',
      arguments: { url: 'http://169.254.169.254/latest/meta-data/' },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/privaten oder reservierten/);
    expect(calls).toHaveLength(0);
  });

  test('meldet einen fehlgeschlagenen Import als Fehler im Ergebnis', async () => {
    const { client } = await connect(() => ({ status: 400, body: { error: 'Ungültige URL' } }));

    const result = (await client.callTool({
      name: 'import_recipe_from_url',
      arguments: { url: 'https://example.test/kaputt' },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Ungültige URL/);
  });
});
