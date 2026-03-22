export interface UnitPriceItem {
  id: string;
  name: string;
  price: string;
  quantity: string;
  unit: string;
  /** Number of units in a pack/bundle (for multi-unit discount scenarios). Defaults to 1. */
  itemCount: string;
}

export interface UnitPriceResult {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  pricePerGram: number;
  isBestDeal: boolean;
}

// Conversion factors to grams (for weight) or mL (for volume)
const WEIGHT_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  catty: 604.79,    // 1 catty (斤) = 604.79g (Hong Kong catty)
  tael: 37.799,     // 1 tael (兩) = 37.799g (Hong Kong tael)
  lb: 453.592,      // 1 pound = 453.592g
  oz: 28.3495,      // 1 ounce = 28.3495g
};

const VOLUME_TO_ML: Record<string, number> = {
  mL: 1,
  L: 1000,
};

// Units that are "countable" (per piece/pack) - convert to per-unit
const COUNT_UNITS = new Set(['piece', 'pack']);

export const SUPPORTED_UNITS = [
  { value: 'g', labelKey: 'unitGram' as const },
  { value: 'kg', labelKey: 'unitKilogram' as const },
  { value: 'catty', labelKey: 'unitCatty' as const },
  { value: 'tael', labelKey: 'unitTael' as const },
  { value: 'lb', labelKey: 'unitPound' as const },
  { value: 'oz', labelKey: 'unitOunce' as const },
  { value: 'mL', labelKey: 'unitMillilitre' as const },
  { value: 'L', labelKey: 'unitLitre' as const },
  { value: 'piece', labelKey: 'unitPiece' as const },
  { value: 'pack', labelKey: 'unitPack' as const },
] as const;

function getUnitType(unit: string): 'weight' | 'volume' | 'count' {
  if (WEIGHT_TO_GRAMS[unit] !== undefined) return 'weight';
  if (VOLUME_TO_ML[unit] !== undefined) return 'volume';
  return 'count';
}

/**
 * Convert a quantity in a given unit to a base unit amount.
 * Weight → grams, Volume → mL, Count → count (1 per unit).
 */
export function convertToBase(quantity: number, unit: string): number {
  const type = getUnitType(unit);
  if (type === 'weight') return quantity * WEIGHT_TO_GRAMS[unit];
  if (type === 'volume') return quantity * VOLUME_TO_ML[unit];
  return quantity; // count
}

/**
 * Compute unit prices for all items and mark the best deal.
 * Items with different unit types (weight vs volume vs count) are compared
 * within their own groups.
 */
export function calculateUnitPrices(items: UnitPriceItem[]): UnitPriceResult[] {
  const validItems = items.filter(
    (item) => item.price && item.quantity && parseFloat(item.price) > 0 && parseFloat(item.quantity) > 0
  );

  if (validItems.length === 0) return [];

  const results: UnitPriceResult[] = validItems.map((item) => {
    const price = parseFloat(item.price);
    const quantity = parseFloat(item.quantity);
    const itemCount = item.itemCount ? parseFloat(item.itemCount) : 1;
    const effectiveCount = itemCount > 0 ? itemCount : 1;
    const baseAmount = convertToBase(quantity, item.unit) * effectiveCount;
    const pricePerGram = price / baseAmount;

    return {
      id: item.id,
      name: item.name || item.id,
      price,
      quantity,
      unit: item.unit,
      pricePerGram,
      isBestDeal: false,
    };
  });

  // Group by unit type and find best deal in each group
  const groups = new Map<string, UnitPriceResult[]>();
  for (const result of results) {
    const type = getUnitType(result.unit);
    const group = groups.get(type) ?? [];
    group.push(result);
    groups.set(type, group);
  }

  for (const group of groups.values()) {
    if (group.length === 0) continue;
    let minPrice = Infinity;
    let bestId = '';
    for (const item of group) {
      if (item.pricePerGram < minPrice) {
        minPrice = item.pricePerGram;
        bestId = item.id;
      }
    }
    for (const item of group) {
      item.isBestDeal = item.id === bestId;
    }
  }

  return results;
}

/**
 * Format the base unit label based on the unit type.
 */
export function getBaseUnitLabel(unit: string): string {
  const type = getUnitType(unit);
  if (type === 'weight') return '/g';
  if (type === 'volume') return '/mL';
  return '/unit';
}

/**
 * Check whether two units can be meaningfully compared.
 */
export function areUnitsComparable(unitA: string, unitB: string): boolean {
  return getUnitType(unitA) === getUnitType(unitB);
}

export { COUNT_UNITS };
