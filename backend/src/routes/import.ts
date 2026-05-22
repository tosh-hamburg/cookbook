import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { decrypt } from '../lib/crypto';

const router = Router();

async function getZeitCookieForUser(prisma: PrismaClient, userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { zeitSessionCookie: true },
  });
  if (!user?.zeitSessionCookie) return null;
  try {
    return decrypt(user.zeitSessionCookie);
  } catch (err) {
    console.error('Zeit-Cookie konnte nicht entschlüsselt werden:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Zeit-spezifisch: Zubereitungsschritte aus dem Artikel-HTML extrahieren.
// Zeit liefert im Recipe-JSON-LD KEINE recipeInstructions, nur recipeIngredient.
// Die Zubereitung steht als <p class="paragraph article__item"> nach einer
// <h2 class="article__subheading article__subheading--recipe ...">.
// Wichtig: In den Rezept-Block schieben sich Newsletter-, Topicbox-,
// Werbe- und Figur-Elemente ein. Die müssen ENTFERNT werden, bevor wir
// nach dem Stopper suchen — sonst bricht ihre eingebettete <h2> die Extraktion
// mitten im Rezept ab (Bug: fehlende letzte Schritte).
function parseZeitInstructions(html: string): string {
  const headingRe = /<h2\b[^>]*class="[^"]*article__subheading--recipe[^"]*"[^>]*>[^<]*<\/h2>/i;
  const headingMatch = html.match(headingRe);
  if (!headingMatch || typeof headingMatch.index !== 'number') return '';

  const afterHeading = html.slice(headingMatch.index + headingMatch[0].length);

  // Irrelevante Blöcke (die eigene h2/h1/p/ingredient-Strukturen enthalten können) wegschneiden.
  const cleaned = afterHeading
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '')
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<template\b[\s\S]*?<\/template>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, '')
    .replace(/<div\s+class="iqdcontainer[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Block bis zum nächsten Struktur-Heading, Ingredient-Liste, Kommentar oder Footer.
  const stopRe = /(<h[12]\b|<div\s+class="ingredient-dice"\b|<div\s+class="recipe-list-collection"\b|<section\b[^>]*comment|<footer\b)/i;
  const stopMatch = cleaned.match(stopRe);
  const block = stopMatch && typeof stopMatch.index === 'number'
    ? cleaned.slice(0, stopMatch.index)
    : cleaned;

  const paragraphRe = /<p\b[^>]*class="[^"]*paragraph\s+article__item[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  const steps: string[] = [];
  let stepNumber = 1;
  let m: RegExpExecArray | null;

  while ((m = paragraphRe.exec(block)) !== null) {
    const text = m[1]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 0) {
      steps.push(`${stepNumber}. ${text}`);
      stepNumber++;
    }
  }

  return steps.join('\n\n');
}

function isZeitHost(hostname: string): boolean {
  return hostname === 'zeit.de' || hostname.endsWith('.zeit.de');
}

// Download image and convert to Base64
async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    // Skip if already Base64
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    
    // Skip non-http URLs
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return null;
    }
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      console.log(`Failed to download image: ${imageUrl} - Status: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Skip if image is too large (> 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      console.log(`Image too large, skipping: ${imageUrl} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      return null;
    }
    
    // Skip if image is too small (likely broken/placeholder)
    if (buffer.length < 1000) {
      console.log(`Image too small, skipping: ${imageUrl} (${buffer.length} bytes)`);
      return null;
    }
    
    const base64 = buffer.toString('base64');
    const mimeType = contentType.split(';')[0].trim();
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.log(`Error downloading image: ${imageUrl}`, error instanceof Error ? error.message : error);
    return null;
  }
}

// Download multiple images with concurrency limit
async function downloadImages(imageUrls: string[], maxImages: number = 10): Promise<string[]> {
  // Limit number of images to download
  const urlsToDownload = imageUrls.slice(0, maxImages);
  
  console.log(`Downloading ${urlsToDownload.length} images...`);
  
  const results: string[] = [];
  
  // Download sequentially to avoid overwhelming the server
  for (const url of urlsToDownload) {
    const base64 = await downloadImageAsBase64(url);
    if (base64) {
      results.push(base64);
      console.log(`Downloaded image ${results.length}/${urlsToDownload.length}`);
    }
  }
  
  console.log(`Successfully downloaded ${results.length} images`);
  return results;
}

interface ScrapedRecipe {
  title: string;
  images: string[];
  ingredients: Array<{ name: string; amount: string }>;
  instructions: string;
  prepTime: number;
  restTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  caloriesPerUnit: number;
  weightUnit: string;
  categories: string[];
  sourceUrl: string;
}

// Helper to parse time strings like "15 Min." or "PT15M"
function parseTime(timeStr: string | undefined): number {
  if (!timeStr) return 0;
  
  // ISO 8601 duration format (PT15M, PT1H30M)
  const isoMatch = timeStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1] || '0', 10);
    const minutes = parseInt(isoMatch[2] || '0', 10);
    return hours * 60 + minutes;
  }
  
  // German format "15 Min." or "1 Std. 30 Min."
  let totalMinutes = 0;
  const hourMatch = timeStr.match(/(\d+)\s*(?:Std|Stunde|h)/i);
  const minMatch = timeStr.match(/(\d+)\s*(?:Min|Minute|m)/i);
  
  if (hourMatch) totalMinutes += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) totalMinutes += parseInt(minMatch[1], 10);
  
  // Plain number
  if (totalMinutes === 0) {
    const plainNum = timeStr.match(/(\d+)/);
    if (plainNum) totalMinutes = parseInt(plainNum[1], 10);
  }
  
  return totalMinutes;
}

// Clean recipe title - remove author name suffix like "von username"
function cleanTitle(title: string): string {
  if (!title) return title;
  // Remove " von [author]" suffix (common on Chefkoch)
  return title.replace(/\s+von\s+\S+$/i, '').trim();
}

// Rekursiv alle Recipe-Objekte aus einem JSON-LD-Schema einsammeln.
// Unterstützt: Top-Level, @graph, ItemList.itemListElement[].item, mainEntity, hasPart.
// Zeit.de verschachtelt Recipes in ItemList > itemListElement > item.
// Rückgabetyp any[] passt zum Rest des JSON-LD-Parsings (unbekanntes Fremdschema).
function collectRecipes(node: any, acc: any[] = []): any[] {
  if (!node || typeof node !== 'object') return acc;

  if (node['@type'] === 'Recipe') acc.push(node);

  if (Array.isArray(node['@graph'])) {
    for (const item of node['@graph']) collectRecipes(item, acc);
  }
  if (Array.isArray(node.itemListElement)) {
    for (const item of node.itemListElement) {
      if (item && typeof item === 'object') {
        if (item['@type'] === 'Recipe') acc.push(item);
        if (item.item) collectRecipes(item.item, acc);
      }
    }
  }
  if (node.mainEntity) collectRecipes(node.mainEntity, acc);
  if (node.hasPart) collectRecipes(node.hasPart, acc);
  return acc;
}

// Parse JSON-LD Recipe schema from HTML
function parseJsonLd(html: string): Partial<ScrapedRecipe> | null {
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  // Collect all parsed recipes to find the most complete one
  const allParsedRecipes: Partial<ScrapedRecipe>[] = [];

  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);

      // Handle array of schemas
      const schemas = Array.isArray(data) ? data : [data];

      for (const schema of schemas) {
        // Sammle Recipes aus allen bekannten Verschachtelungen
        const recipes = collectRecipes(schema);
        
        for (const recipe of recipes) {
          const ingredients: Array<{ name: string; amount: string }> = [];
          
          // Parse ingredients
          if (recipe.recipeIngredient) {
            for (const ing of recipe.recipeIngredient) {
              // Try to split amount from name - extended pattern for German units
              const ingMatch = ing.match(/^([\d.,\/\s]+\s*(?:gramm|kilogramm|milliliter|liter|Esslöffel|Teelöffel|Scheiben|Scheibe|Prisen|Packung|Dosen|Zehen|Tassen|Handvoll|Stück|Würfel|Becher|Bund|Prise|Tasse|Dose|Zehe|Pkg|Stk|kg|ml|cl|dl|EL|TL|g|l|etwas|n\.?\s*B\.?)?)\s*(.+)$/i);
              if (ingMatch) {
                ingredients.push({ amount: ingMatch[1].trim(), name: ingMatch[2].trim() });
              } else {
                ingredients.push({ amount: '', name: ing });
              }
            }
          }
          
          // Parse instructions - handle various formats (string, HowToStep, HowToSection)
          let instructions = '';
          if (recipe.recipeInstructions) {
            if (typeof recipe.recipeInstructions === 'string') {
              instructions = recipe.recipeInstructions;
            } else if (Array.isArray(recipe.recipeInstructions)) {
              const steps: string[] = [];
              let stepNumber = 1;
              
              const extractText = (item: any): string[] => {
                const texts: string[] = [];
                if (typeof item === 'string') {
                  texts.push(item);
                } else if (item['@type'] === 'HowToSection' && item.itemListElement) {
                  // HowToSection contains nested steps
                  for (const subItem of item.itemListElement) {
                    texts.push(...extractText(subItem));
                  }
                } else if (item['@type'] === 'HowToStep') {
                  // HowToStep has text property
                  if (item.text) texts.push(item.text);
                  else if (item.name) texts.push(item.name);
                } else if (item.text) {
                  texts.push(item.text);
                } else if (item.name) {
                  texts.push(item.name);
                }
                return texts;
              };
              
              for (const item of recipe.recipeInstructions) {
                const texts = extractText(item);
                for (const text of texts) {
                  if (text.trim()) {
                    steps.push(`${stepNumber}. ${text.trim()}`);
                    stepNumber++;
                  }
                }
              }
              
              instructions = steps.join('\n\n');
            }
          }
          
          // Parse servings (recipeYield)
          let servings = 4;
          if (recipe.recipeYield) {
            const yieldValue = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
            const yieldMatch = String(yieldValue).match(/(\d+)/);
            if (yieldMatch) {
              servings = parseInt(yieldMatch[1], 10);
            }
          }
          
          // Parse images - handle various formats (string, ImageObject, array)
          const images: string[] = [];
          const addImage = (img: any) => {
            if (!img) return;
            if (typeof img === 'string') {
              if (!images.includes(img)) images.push(img);
            } else if (img.url) {
              if (!images.includes(img.url)) images.push(img.url);
            } else if (img.contentUrl) {
              if (!images.includes(img.contentUrl)) images.push(img.contentUrl);
            } else if (img['@id']) {
              // Some sites reference images by @id
              if (!images.includes(img['@id'])) images.push(img['@id']);
            }
          };
          
          if (recipe.image) {
            const imgData = Array.isArray(recipe.image) ? recipe.image : [recipe.image];
            for (const img of imgData) {
              addImage(img);
            }
          }
          
          // Also check for thumbnailUrl (often used by Chefkoch)
          if (recipe.thumbnailUrl) {
            const thumbs = Array.isArray(recipe.thumbnailUrl) ? recipe.thumbnailUrl : [recipe.thumbnailUrl];
            for (const thumb of thumbs) {
              addImage(thumb);
            }
          }
          
          // Parse nutrition
          let caloriesPerUnit = 0;
          let weightUnit = '100g';
          if (recipe.nutrition) {
            const calMatch = recipe.nutrition.calories?.match(/(\d+)/);
            if (calMatch) caloriesPerUnit = parseInt(calMatch[1], 10);
            if (recipe.nutrition.servingSize) weightUnit = recipe.nutrition.servingSize;
          }
          
          // Add to collection instead of returning immediately
          allParsedRecipes.push({
            title: cleanTitle(recipe.name || ''),
            images,
            ingredients,
            instructions,
            prepTime: parseTime(recipe.prepTime),
            cookTime: parseTime(recipe.cookTime),
            totalTime: parseTime(recipe.totalTime),
            restTime: 0,
            servings,
            caloriesPerUnit,
            weightUnit,
            categories: recipe.recipeCategory 
              ? (Array.isArray(recipe.recipeCategory) ? recipe.recipeCategory : [recipe.recipeCategory])
              : [],
          });
        }
      }
    } catch (e) {
      // Continue to next script tag
    }
  }
  
  // Return the most complete recipe (one with most ingredients)
  if (allParsedRecipes.length === 0) {
    return null;
  }
  
  // Sort by completeness: ingredients count, then instructions length
  allParsedRecipes.sort((a, b) => {
    const aScore = (a.ingredients?.length || 0) * 100 + (a.instructions?.length || 0);
    const bScore = (b.ingredients?.length || 0) * 100 + (b.instructions?.length || 0);
    return bScore - aScore;
  });
  
  console.log(`Found ${allParsedRecipes.length} JSON-LD recipes, selected one with ${allParsedRecipes[0].ingredients?.length || 0} ingredients`);
  
  return allParsedRecipes[0];
}

// Fallback HTML parsing for Chefkoch - extracts additional images from HTML
function parseChefkochHtml(html: string): Partial<ScrapedRecipe> | null {
  const result: Partial<ScrapedRecipe> = {
    ingredients: [],
    images: [],
    categories: [],
  };
  
  // Title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) result.title = cleanTitle(titleMatch[1].trim());
  
  // Extract all images from recipe slider/gallery
  // Method 1: amp-img tags with recipe slider class
  const ampImgMatches = html.matchAll(/amp-img[^>]*src=["']([^"']+)["'][^>]*/gi);
  for (const match of ampImgMatches) {
    const src = match[1];
    // Filter for recipe images (typically high resolution)
    if (src && (src.includes('/rezepte/') || src.includes('bilder.t-online') || src.includes('chefkoch'))) {
      if (!result.images!.includes(src)) {
        result.images!.push(src);
      }
    }
  }
  
  // Method 2: Regular img tags in gallery
  const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*(?:class=["'][^"']*(?:slider|gallery|recipe)[^"']*["'])?[^>]*>/gi);
  for (const match of imgMatches) {
    const src = match[1];
    // Filter for recipe images
    if (src && (src.includes('/rezepte/') || src.includes('bilder.t-online'))) {
      if (!result.images!.includes(src)) {
        result.images!.push(src);
      }
    }
  }
  
  // Method 3: Look for image URLs in data attributes or JSON embedded in HTML
  const dataImgMatches = html.matchAll(/["'](https?:\/\/[^"']*(?:\/rezepte\/|bilder\.)[^"']*\.(?:jpg|jpeg|png|webp))["']/gi);
  for (const match of dataImgMatches) {
    const src = match[1];
    // Prefer larger images (avoid thumbnails)
    if (src && !src.includes('thumb') && !src.includes('_w100') && !src.includes('_w200')) {
      if (!result.images!.includes(src)) {
        result.images!.push(src);
      }
    }
  }
  
  return result;
}

// HTML parsing for Kochbar.de - extracts images and ingredients from HTML
function parseKochbarHtml(html: string): Partial<ScrapedRecipe> | null {
  const result: Partial<ScrapedRecipe> = {
    ingredients: [],
    images: [],
    categories: [],
  };
  
  // Title from h1
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) result.title = cleanTitle(titleMatch[1].trim());
  
  // Extract ingredients from table rows (Kochbar uses tables for ingredients)
  // Pattern: <td>Zutat</td><td>Menge</td>
  const tableRowMatches = html.matchAll(/<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/gi);
  for (const match of tableRowMatches) {
    const name = match[1].trim();
    const amount = match[2].trim();
    // Filter out header rows or empty rows
    if (name && name.toLowerCase() !== 'zutat' && name.toLowerCase() !== 'zutaten' && !name.includes('Zutaten')) {
      result.ingredients!.push({ name, amount });
    }
  }
  
  // Also try to extract from ingredient list with class (alternative format)
  const ingredientListMatches = html.matchAll(/<li[^>]*class="[^"]*ingredient[^"]*"[^>]*>([^<]+)<\/li>/gi);
  for (const match of ingredientListMatches) {
    const text = match[1].trim();
    // Try to split amount from name
    const splitMatch = text.match(/^([\d.,\/\s]+\s*(?:gramm|kilogramm|milliliter|liter|Esslöffel|Teelöffel|Scheiben|Scheibe|Prisen|Packung|Dosen|Zehen|Tassen|Handvoll|Stück|Würfel|Becher|Bund|Prise|Tasse|Dose|Zehe|Pkg|Stk|kg|ml|cl|dl|EL|TL|g|l|etwas|n\.?\s*B\.?)?)\s*(.+)$/i);
    if (splitMatch) {
      result.ingredients!.push({ amount: splitMatch[1].trim(), name: splitMatch[2].trim() });
    } else {
      result.ingredients!.push({ amount: '', name: text });
    }
  }
  
  // Extract instructions if not in JSON-LD
  const instructionMatch = html.match(/<div[^>]*class="[^"]*(?:instructions?|preparation|zubereitung)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (instructionMatch) {
    // Strip HTML tags and clean up
    let instructions = instructionMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (instructions) {
      result.instructions = instructions;
    }
  }
  
  // Extract images from gallery - Kochbar uses data-src or src in img tags
  // Look for recipe images in the gallery
  const imgMatches = html.matchAll(/<img[^>]*(?:data-src|src)=["']([^"']+)["'][^>]*>/gi);
  for (const match of imgMatches) {
    const src = match[1];
    // Filter for Kochbar recipe images (contain "rezeptbilder" or similar patterns)
    if (src && (src.includes('rezeptbild') || src.includes('kochbar') || src.includes('/rezept'))) {
      // Prefer larger images
      if (!src.includes('thumb') && !src.includes('_xs') && !src.includes('_s.')) {
        if (!result.images!.includes(src)) {
          result.images!.push(src);
        }
      }
    }
  }
  
  // Also look for image URLs in JSON or data attributes
  const jsonImgMatches = html.matchAll(/["'](https?:\/\/[^"']*kochbar[^"']*\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi);
  for (const match of jsonImgMatches) {
    let src = match[1];
    // Clean up any escaped characters
    src = src.replace(/\\u002F/g, '/');
    // Prefer larger images
    if (src && !src.includes('thumb') && !src.includes('_xs') && !src.includes('_s.')) {
      if (!result.images!.includes(src)) {
        result.images!.push(src);
      }
    }
  }
  
  // Look for srcset patterns which often have multiple image sizes
  const srcsetMatches = html.matchAll(/srcset=["']([^"']+)["']/gi);
  for (const match of srcsetMatches) {
    const srcset = match[1];
    // Extract URLs from srcset (format: "url1 1x, url2 2x" or "url1 100w, url2 200w")
    const urls = srcset.split(',').map(s => s.trim().split(/\s+/)[0]);
    for (const url of urls) {
      if (url && (url.includes('rezeptbild') || url.includes('kochbar'))) {
        if (!result.images!.includes(url)) {
          result.images!.push(url);
        }
      }
    }
  }
  
  return result;
}

// Import recipe from URL
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body;
    
    console.log('Import request received for URL:', url);
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL ist erforderlich' });
    }
    
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Ungültige URL' });
    }
    
    console.log('Fetching page from:', parsedUrl.hostname);

    // Optional: Zeit.de Session-Cookie des Users mitschicken, um Paywall zu umgehen
    const prisma: PrismaClient = req.app.locals.prisma;
    let zeitCookie: string | null = null;
    if (isZeitHost(parsedUrl.hostname)) {
      zeitCookie = await getZeitCookieForUser(prisma, req.user!.id);
      if (zeitCookie) {
        // Logge nur Cookie-Namen und Wert-Längen (Werte sind sensitiv).
        const cookieInfo = zeitCookie.split(/;\s*/).map(p => {
          const eq = p.indexOf('=');
          return eq > 0 ? `${p.slice(0, eq)}(len=${p.length - eq - 1})` : `${p}(no-value)`;
        });
        console.log('Zeit cookie attached:', cookieInfo.join(', '));
      } else {
        console.log('Zeit cookie NOT attached (none stored or decryption failed)');
      }
    }

    // Fetch the page with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const requestHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    };
    if (zeitCookie) {
      requestHeaders['Cookie'] = zeitCookie;
    }

    let response;
    try {
      response = await fetch(url, {
        headers: requestHeaders,
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', fetchError);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return res.status(408).json({ error: 'Zeitüberschreitung beim Laden der Seite' });
      }
      return res.status(400).json({ error: `Konnte Seite nicht abrufen: ${fetchError instanceof Error ? fetchError.message : 'Netzwerkfehler'}` });
    }
    clearTimeout(timeoutId);
    
    console.log('Fetch response status:', response.status);
    
    if (!response.ok) {
      return res.status(400).json({ error: `Konnte Seite nicht laden: ${response.status}` });
    }
    
    const html = await response.text();
    console.log('Page fetched, HTML length:', html.length);

    // Try JSON-LD first
    let recipe = parseJsonLd(html);
    console.log('JSON-LD parsing result:', recipe ? `Found recipe: ${recipe.title}` : 'No JSON-LD found');
    
    // For Chefkoch: Always try to get additional images from HTML
    if (parsedUrl.hostname.includes('chefkoch')) {
      const htmlData = parseChefkochHtml(html);
      if (htmlData) {
        // Merge HTML data with JSON-LD, but combine images instead of replacing
        const combinedImages = [...(recipe?.images || [])];
        for (const img of (htmlData.images || [])) {
          if (!combinedImages.includes(img)) {
            combinedImages.push(img);
          }
        }
        
        // Keep JSON-LD data if available (more reliable) - don't let HTML overwrite
        recipe = { 
          ...htmlData,  // HTML data first (lower priority)
          ...recipe,    // JSON-LD data second (higher priority, overwrites HTML)
          images: combinedImages,
          // Explicitly keep JSON-LD values if they exist
          title: recipe?.title || htmlData.title,
          instructions: recipe?.instructions || htmlData.instructions,
          ingredients: (recipe?.ingredients && recipe.ingredients.length > 0) 
            ? recipe.ingredients 
            : htmlData.ingredients,
        };
      }
    }
    
    // For Zeit: JSON-LD liefert keine recipeInstructions – diese aus HTML extrahieren.
    // Außerdem: Wenn die Seite als Paywall-truncated markiert ist, liefern wir eine klare Fehlermeldung.
    if (isZeitHost(parsedUrl.hostname)) {
      const isTruncated =
        /<html[^>]*\sdata-is-truncated-by-paywall\b/i.test(html) ||
        /"paywall"\s*:\s*"hard"/i.test(html);
      if (isTruncated) {
        const msg = zeitCookie
          ? 'Zeit-Session ist abgelaufen oder ungültig. Bitte Cookie in den Einstellungen erneuern.'
          : 'Dieses Rezept ist hinter der Zeit-Paywall. Bitte hinterlege dein Zeit-Session-Cookie in den Einstellungen.';
        return res.status(403).json({ error: msg });
      }

      if (recipe && (!recipe.instructions || recipe.instructions.trim().length === 0)) {
        const instructions = parseZeitInstructions(html);
        if (instructions) {
          recipe = { ...recipe, instructions };
        }
      }
    }

    // For Kochbar: Always try to get additional data from HTML
    if (parsedUrl.hostname.includes('kochbar')) {
      const htmlData = parseKochbarHtml(html);
      if (htmlData) {
        // Merge HTML data with JSON-LD, but combine images instead of replacing
        const combinedImages = [...(recipe?.images || [])];
        for (const img of (htmlData.images || [])) {
          if (!combinedImages.includes(img)) {
            combinedImages.push(img);
          }
        }
        
        // Use HTML ingredients if JSON-LD has none or empty
        const ingredients = (recipe?.ingredients && recipe.ingredients.length > 0) 
          ? recipe.ingredients 
          : htmlData.ingredients;
        
        recipe = { 
          ...recipe, 
          ...htmlData,
          images: combinedImages,
          ingredients: ingredients,
          // Keep JSON-LD data if available (more reliable)
          title: recipe?.title || htmlData.title,
          instructions: recipe?.instructions || htmlData.instructions,
        };
      }
    }
    
    if (!recipe || !recipe.title) {
      if (isZeitHost(parsedUrl.hostname)) {
        // Zusatzdiagnose für zeit.de: Fehlendes Recipe-JSON-LD deutet auf
        // nicht-autorisierten Zugriff hin — auch ohne sichtbares Paywall-Attribut.
        const hasRecipeHint = /"@type"\s*:\s*"Recipe"/.test(html);
        const looksTruncated = /\sdata-is-truncated-by-paywall\b/i.test(html)
          || /"paywall"\s*:\s*"hard"/i.test(html)
          || /window\.Zeit\.user\.paywall\s*=\s*"(paid|hard)"/i.test(html);
        console.log('Zeit import failed:', {
          cookieSent: !!zeitCookie,
          htmlLength: html.length,
          hasRecipeJsonLd: hasRecipeHint,
          looksTruncated,
        });
        const msg = zeitCookie
          ? 'Rezept nicht lesbar. Dein Zeit-Session-Cookie scheint abgelaufen oder für dieses Rezept nicht gültig. Bitte erneuere ihn in den Einstellungen.'
          : 'Dieses Rezept ist hinter der Zeit-Paywall. Bitte hinterlege dein Zeit-Session-Cookie in den Einstellungen (Profil → Sicherheit → Zeit-Abo verbinden).';
        return res.status(403).json({ error: msg });
      }
      return res.status(400).json({ error: 'Konnte kein Rezept auf dieser Seite finden' });
    }
    
    // Debug log for imported data
    console.log('Imported recipe data:', {
      title: recipe.title,
      ingredientsCount: recipe.ingredients?.length || 0,
      imagesCount: recipe.images?.length || 0,
      hasInstructions: !!recipe.instructions,
      servings: recipe.servings
    });
    
    // Download images and convert to Base64 (limit to 5 images)
    const downloadedImages = await downloadImages(recipe.images || [], 5);
    
    console.log(`Downloaded ${downloadedImages.length} images as Base64`);
    
    // Add source URL and defaults
    const result: ScrapedRecipe = {
      title: cleanTitle(recipe.title || '') || 'Importiertes Rezept',
      images: downloadedImages,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || '',
      prepTime: recipe.prepTime || 0,
      restTime: recipe.restTime || 0,
      cookTime: recipe.cookTime || 0,
      totalTime: recipe.totalTime || (recipe.prepTime || 0) + (recipe.cookTime || 0),
      servings: recipe.servings || 4,
      caloriesPerUnit: recipe.caloriesPerUnit || 0,
      weightUnit: recipe.weightUnit || 'Portion',
      categories: recipe.categories || [],
      sourceUrl: url,
    };
    
    console.log('Import successful:', result.title);
    res.json(result);
  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    res.status(500).json({ error: `Fehler beim Importieren: ${errorMessage}` });
  }
});

export default router;
