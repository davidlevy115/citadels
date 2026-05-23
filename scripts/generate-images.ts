import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(import.meta.dirname, '../apps/web/public/images/cards');
const WIDTH = 400;
const HEIGHT = 560;

const STYLE_SUFFIX = 'fantasy medieval card game art, oil painting style, rich colors, dramatic lighting, detailed, no text, no letters, no words, no writing';

const DISTRICT_PROMPTS: Record<string, string> = {
  // Noble (Yellow)
  'Manor': `elegant stone manor house with yellow banners, manicured gardens, noble estate at golden hour, ${STYLE_SUFFIX}`,
  'Castle': `grand medieval castle on a hilltop, golden flags flying, stone towers and battlements, ${STYLE_SUFFIX}`,
  'Palace': `opulent royal palace with golden domes, marble columns, grand staircase, fountain courtyard, ${STYLE_SUFFIX}`,

  // Religious (Blue)
  'Temple': `small ancient stone temple with blue stained glass, candles glowing inside, peaceful, ${STYLE_SUFFIX}`,
  'Church': `medieval stone church with blue stained glass windows, bell tower, moonlit, ${STYLE_SUFFIX}`,
  'Monastery': `secluded hilltop monastery surrounded by mist, blue rooftops, monks garden, ${STYLE_SUFFIX}`,
  'Cathedral': `magnificent gothic cathedral with flying buttresses, blue rose window, towering spires, ${STYLE_SUFFIX}`,

  // Trade (Green)
  'Tavern': `cozy medieval tavern with green door, warm light from windows, hanging sign, bustling street, ${STYLE_SUFFIX}`,
  'Market': `bustling medieval marketplace with green awnings, merchant stalls, colorful goods, crowds, ${STYLE_SUFFIX}`,
  'Trading Post': `wooden trading post building at a crossroads, wagons, barrels of goods, green flags, ${STYLE_SUFFIX}`,
  'Docks': `medieval harbor docks with merchant ships, wooden piers, cargo crates, seagulls, ${STYLE_SUFFIX}`,
  'Harbor': `grand medieval harbor with tall ships, stone lighthouse, warehouses along the waterfront, ${STYLE_SUFFIX}`,
  'Town Hall': `imposing medieval town hall with green copper roof, clock tower, market square, ${STYLE_SUFFIX}`,

  // Military (Red)
  'Watchtower': `lone stone watchtower on a cliff, red banner, torches burning, overlooking dark landscape, ${STYLE_SUFFIX}`,
  'Prison': `grim medieval prison tower with iron bars, red torchlight, dark stone walls, chains, ${STYLE_SUFFIX}`,
  'Battlefield': `dramatic medieval battlefield aftermath, red banners, broken shields and swords, stormy sky, ${STYLE_SUFFIX}`,
  'Fortress': `massive stone fortress with red flags, thick walls, catapults, mountain stronghold, ${STYLE_SUFFIX}`,

  // Special (Purple)
  'Haunted City': `ethereal ghostly city with purple mist, spectral buildings, glowing windows, haunting atmosphere, ${STYLE_SUFFIX}`,
  'Keep': `impenetrable stone keep with purple banners, iron-bound door, thick walls, unbreakable, ${STYLE_SUFFIX}`,
  'Laboratory': `alchemist laboratory with bubbling potions, purple smoke, glowing crystals, mystical apparatus, ${STYLE_SUFFIX}`,
  'Smithy': `magical forge and smithy, purple flames, glowing metal, anvil with sparks, enchanted weapons, ${STYLE_SUFFIX}`,
  'Graveyard': `moonlit medieval graveyard with purple fog, ornate tombstones, iron gates, weeping willow, ${STYLE_SUFFIX}`,
  'Observatory': `tall observatory tower with telescope, starry purple night sky, celestial instruments, ${STYLE_SUFFIX}`,
  'Library': `grand medieval library with towering bookshelves, purple tapestries, glowing magical tomes, ${STYLE_SUFFIX}`,
  'School of Magic': `mystical school of magic with purple towers, floating books, magical energy, arcane symbols, ${STYLE_SUFFIX}`,
  'Dragon Gate': `enormous dragon-shaped gate with purple fire, carved stone dragons, magical energy, epic scale, ${STYLE_SUFFIX}`,
  'University': `prestigious medieval university, purple robed scholars, grand courtyard, wisdom and knowledge, ${STYLE_SUFFIX}`,
  'Great Wall': `massive fortified great wall stretching into distance, purple twilight, watchtowers, impenetrable, ${STYLE_SUFFIX}`,
};

const CHARACTER_PROMPTS: Record<string, string> = {
  'Assassin': `hooded assassin lurking in shadows, dark cloak, dagger gleaming, mysterious dangerous figure, portrait, ${STYLE_SUFFIX}`,
  'Thief': `charming rogue thief with mask, coin purse, sly smile, moonlit rooftop, portrait, ${STYLE_SUFFIX}`,
  'Magician': `powerful court magician with glowing staff, swirling magical energy, mystical robes, portrait, ${STYLE_SUFFIX}`,
  'King': `majestic king with golden crown, royal robes, scepter, regal bearing, throne room, portrait, ${STYLE_SUFFIX}`,
  'Bishop': `wise bishop in ornate blue vestments, golden mitre, holy book, cathedral background, portrait, ${STYLE_SUFFIX}`,
  'Merchant': `wealthy merchant with scales and gold coins, fine green clothes, confident smile, portrait, ${STYLE_SUFFIX}`,
  'Architect': `master architect with blueprints and compass, thoughtful expression, buildings rising behind, portrait, ${STYLE_SUFFIX}`,
  'Warlord': `fierce warlord in red battle armor, war banner, scarred face, burning city backdrop, portrait, ${STYLE_SUFFIX}`,
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

async function downloadImage(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buffer);
}

async function main() {
  mkdirSync(join(OUT_DIR, 'districts'), { recursive: true });
  mkdirSync(join(OUT_DIR, 'characters'), { recursive: true });

  console.log('Generating district card images...');
  for (const [name, prompt] of Object.entries(DISTRICT_PROMPTS)) {
    const slug = slugify(name);
    const path = join(OUT_DIR, 'districts', `${slug}.jpg`);
    if (existsSync(path)) {
      console.log(`  [skip] ${name} (already exists)`);
      continue;
    }
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${WIDTH}&height=${HEIGHT}&nologo=true&seed=${slug.length * 42}`;
    console.log(`  [generating] ${name}...`);
    try {
      await downloadImage(url, path);
      console.log(`  [done] ${name}`);
    } catch (e: any) {
      console.error(`  [error] ${name}: ${e.message}`);
    }
    // small delay to be polite to the API
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nGenerating character card images...');
  for (const [name, prompt] of Object.entries(CHARACTER_PROMPTS)) {
    const slug = slugify(name);
    const path = join(OUT_DIR, 'characters', `${slug}.jpg`);
    if (existsSync(path)) {
      console.log(`  [skip] ${name} (already exists)`);
      continue;
    }
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${WIDTH}&height=${HEIGHT}&nologo=true&seed=${slug.length * 77}`;
    console.log(`  [generating] ${name}...`);
    try {
      await downloadImage(url, path);
      console.log(`  [done] ${name}`);
    } catch (e: any) {
      console.error(`  [error] ${name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nDone! Images saved to apps/web/public/images/cards/');
}

main().catch(console.error);
