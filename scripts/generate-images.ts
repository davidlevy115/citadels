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

// One entry per character in the deluxe roster. Characters sharing a rank share
// a colour cue so the cast still reads as a set: 1 grey/black, 2 brown, 3 indigo,
// 4 gold, 5 blue, 6 green, 7 amber, 8 red, 9 pink/violet.
const CHARACTER_PROMPTS: Record<string, string> = {
  // ── Rank 1 ──
  'Assassin': `hooded assassin lurking in shadows, dark cloak, dagger gleaming, mysterious dangerous figure, portrait, ${STYLE_SUFFIX}`,
  'Witch': `sinister witch casting a hex, glowing green eyes, gnarled staff, black tattered robes, swirling dark smoke, night forest, portrait, ${STYLE_SUFFIX}`,
  'Magistrate': `stern medieval magistrate in black judge robes, holding a wax-sealed warrant scroll, gavel, iron chain of office, courtroom shadows, portrait, ${STYLE_SUFFIX}`,

  // ── Rank 2 ──
  'Thief': `charming rogue thief with mask, coin purse, sly smile, moonlit rooftop, portrait, ${STYLE_SUFFIX}`,
  'Spy': `secretive spy peering from beneath a wide brown hood, brown leather cloak, spyglass, listening at a door, candlelit corridor, portrait, ${STYLE_SUFFIX}`,
  'Blackmailer': `scheming blackmailer holding a sealed incriminating letter, smug knowing grin, brown coat, dim tavern back room, portrait, ${STYLE_SUFFIX}`,

  // ── Rank 3 ──
  'Magician': `powerful court magician with glowing staff, swirling magical energy, mystical robes, portrait, ${STYLE_SUFFIX}`,
  'Wizard': `venerable wizard with long white beard, indigo star-covered robes and pointed hat, floating spellbook, arcane runes glowing, portrait, ${STYLE_SUFFIX}`,
  'Seer': `mysterious blindfolded seer with hands over a glowing crystal ball, indigo veils, visions of cards swirling in the mist, portrait, ${STYLE_SUFFIX}`,

  // ── Rank 4 ──
  'King': `majestic king with golden crown, royal robes, scepter, regal bearing, throne room, portrait, ${STYLE_SUFFIX}`,
  'Emperor': `imposing emperor in golden laurel crown and imperial purple and gold robes, holding out a crown to give away, marble palace, portrait, ${STYLE_SUFFIX}`,
  'Patrician': `refined patrician noble in golden brocade, holding a fan of parchment deeds, aristocratic bearing, sunlit estate balcony, portrait, ${STYLE_SUFFIX}`,

  // ── Rank 5 ──
  'Bishop': `wise bishop in ornate blue vestments, golden mitre, holy book, cathedral background, portrait, ${STYLE_SUFFIX}`,
  'Abbot': `humble round-faced abbot in blue monastic habit, hands folded, small coin purse and scroll at his belt, abbey cloister, portrait, ${STYLE_SUFFIX}`,
  'Cardinal': `shrewd cardinal in deep blue and crimson robes with a wide brimmed hat, holding a stack of cards and a coin, basilica interior, portrait, ${STYLE_SUFFIX}`,

  // ── Rank 6 ──
  'Merchant': `wealthy merchant with scales and gold coins, fine green clothes, confident smile, portrait, ${STYLE_SUFFIX}`,
  'Alchemist': `absorbed alchemist in green robes turning lead into gold, bubbling green retorts and flasks, gold coins reforming in the air, laboratory, portrait, ${STYLE_SUFFIX}`,
  'Trader': `seasoned trader in green travelling clothes beside crates and bolts of cloth, ledger in hand, busy quayside with ships, portrait, ${STYLE_SUFFIX}`,

  // ── Rank 7 ──
  'Architect': `master architect with blueprints and compass, thoughtful expression, buildings rising behind, portrait, ${STYLE_SUFFIX}`,
  'Navigator': `weathered navigator in amber coat holding an astrolabe and rolled sea chart, compass rose, ship deck under a golden sunset, portrait, ${STYLE_SUFFIX}`,
  'Scholar': `bookish scholar in amber academic robes surrounded by towering stacks of manuscripts, quill in hand, candlelit study, portrait, ${STYLE_SUFFIX}`,

  // ── Rank 8 ──
  'Warlord': `fierce warlord in red battle armor, war banner, scarred face, burning city backdrop, portrait, ${STYLE_SUFFIX}`,
  'Diplomat': `smooth diplomat in red and gold envoy's sash, offering a signed treaty with one hand, calculating smile, war camp tent, portrait, ${STYLE_SUFFIX}`,
  'Marshal': `armoured marshal in red tabard with a badge of office, gauntlet resting on a sword hilt, seizing a deed, city gate, portrait, ${STYLE_SUFFIX}`,

  // ── Rank 9 ──
  'Queen': `regal queen in a violet gown and jewelled tiara, seated beside an empty throne, poised and watchful, palace hall, portrait, ${STYLE_SUFFIX}`,
  'Artist': `flamboyant artist in a pink smock with paint-stained hands, brush and palette, gilding a stone facade, workshop of statues, portrait, ${STYLE_SUFFIX}`,
  'Tax Collector': `gaunt tax collector in violet robes counting a heap of gold coins into a strongbox, ledger and quill, greedy expression, portrait, ${STYLE_SUFFIX}`,
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Stable per-name seed. Name length alone collides badly once there are 27
 * characters, which makes different cards come back looking alike.
 */
function seedFor(slug: string, salt: number): number {
  let hash = salt;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash % 1_000_000;
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
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${WIDTH}&height=${HEIGHT}&nologo=true&seed=${seedFor(slug, 42)}`;
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
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${WIDTH}&height=${HEIGHT}&nologo=true&seed=${seedFor(slug, 77)}`;
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
