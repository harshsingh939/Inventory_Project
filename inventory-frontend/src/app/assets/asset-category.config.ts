/** How the category add-form and table behave */
export type AssetUiVariant = 'pc' | 'compact';

export interface AssetCategoryDefinition {
  slug: string;
  title: string;
  blurb: string;
  icon: string;
  ui: AssetUiVariant;
  /** Stored `asset_type` values — matched case-insensitively */
  types: readonly string[];
}

/** Normalize DB/catalog asset_type for comparisons (spacing, slashes) */
export function sessionAssetTypeKey(s: string | null | undefined): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/');
}

const norm = (s: string) => sessionAssetTypeKey(s);

export const ASSET_CATEGORY_MAP: Record<string, AssetCategoryDefinition> = {
  systems: {
    slug: 'systems',
    title: 'Computers & workstations',
    blurb: 'Systems, laptops, desktops — assign to employees via Sessions.',
    icon: '💻',
    ui: 'pc',
    types: ['System', 'Laptop', 'Desktop', 'Workstation', 'Tablet'],
  },
  cameras: {
    slug: 'cameras',
    title: 'Cameras & imaging',
    blurb: 'Webcams and network cameras — inventory & repairs only (not session checkout).',
    icon: '📷',
    ui: 'compact',
    types: ['Webcam', 'IP Camera', 'CCTV Camera'],
  },
  power: {
    slug: 'power',
    title: 'Power & electrical',
    blurb: 'Extension boards, UPS, strips — assign via Sessions or track by serial / model.',
    icon: '🔌',
    ui: 'compact',
    types: ['Extension Board', 'Power Strip', 'UPS', 'Adapter / Charger'],
  },
  network: {
    slug: 'network',
    title: 'Network equipment',
    blurb: 'Routers, switches, Wi‑Fi — same repair flow as other assets.',
    icon: '🌐',
    ui: 'compact',
    types: ['Router', 'Switch', 'Access Point', 'Firewall', 'NAS'],
  },
  peripherals: {
    slug: 'peripherals',
    title: 'Peripherals & storage',
    blurb: 'Keyboards, docks, monitors, external drives, phones — assign via Sessions like computers.',
    icon: '🖱️',
    ui: 'compact',
    types: [
      'Keyboard',
      'Mouse',
      'Headset',
      'Speaker',
      'Microphone',
      'USB Hub',
      'Dock',
      'Monitor',
      'External HDD',
      'External SSD',
      'Hard Phone',
      'Phone',
    ],
  },
  'av-print': {
    slug: 'av-print',
    title: 'AV & print',
    blurb: 'Printers, scanners, projectors.',
    icon: '🖨️',
    ui: 'compact',
    types: ['Printer', 'Scanner', 'Projector'],
  },
  cables: {
    slug: 'cables',
    title: 'Cables',
    blurb: 'HDMI, display, and network cables — assign via Sessions or track in inventory.',
    icon: '🔗',
    ui: 'compact',
    types: ['HDMI Cable', 'Display Cable', 'LAN Cable'],
  },
  furniture: {
    slug: 'furniture',
    title: 'Furniture',
    blurb: 'Desks, chairs — optional serial or asset tag in Serial field.',
    icon: '🪑',
    ui: 'compact',
    types: ['Desk', 'Chair'],
  },
};

/** Cards on /assets hub (order matters) */
export const HUB_CATEGORY_ORDER = [
  'systems',
  'cameras',
  'power',
  'network',
  'peripherals',
  'av-print',
  'cables',
  'furniture',
  'other',
] as const;

export type HubCategorySlug = (typeof HUB_CATEGORY_ORDER)[number];

export function definitionForSlug(slug: string): AssetCategoryDefinition | null {
  if (slug === 'other') {
    return {
      slug: 'other',
      title: 'Other inventory',
      blurb: 'Anything that does not fit the categories above (custom types, accessories).',
      icon: '📦',
      ui: 'compact',
      types: [],
    };
  }
  return ASSET_CATEGORY_MAP[slug] ?? null;
}

/** Category slugs whose `types` may be checked out in Sessions (with systems / computers) */
export const SESSION_ASSIGNABLE_CATEGORY_SLUGS = [
  'systems',
  'peripherals',
  'power',
  'cables',
] as const;

export function isSessionAssignableCategorySlug(slug: string): boolean {
  return (SESSION_ASSIGNABLE_CATEGORY_SLUGS as readonly string[]).includes(slug);
}

/** Types allowed in Sessions — computers, peripherals & storage, power, cables */
export function sessionAssignableTypeSet(): Set<string> {
  const out = new Set<string>();
  for (const slug of SESSION_ASSIGNABLE_CATEGORY_SLUGS) {
    const def = ASSET_CATEGORY_MAP[slug];
    if (!def) continue;
    for (const t of def.types) {
      out.add(sessionAssetTypeKey(t));
    }
  }
  return out;
}

function matchesKnownNonOther(assetType: string): boolean {
  return Object.keys(ASSET_CATEGORY_MAP).some((slug) =>
    ASSET_CATEGORY_MAP[slug].types.some((t) => norm(t) === norm(assetType)),
  );
}

export function assetBelongsToSlug(assetType: string, slug: string): boolean {
  if (slug === 'other') {
    return !matchesKnownNonOther(assetType);
  }
  const def = ASSET_CATEGORY_MAP[slug];
  if (!def) return false;
  return def.types.some((t) => norm(t) === norm(assetType));
}
