import type { Product } from '../components/sales/SalesModule';
import type { BespokeFabricMaterial } from '../types/bespoke';
import {
  hydrateFabricDraftsFromChildren,
  syncFabricChildLines,
  type BespokeCartLineBase,
} from './bespokeCartInjection';

export function lineCartId(p: Product, index: number): string {
  return p.cartLineId ?? `${p.id}-${p.variationId ?? 'base'}-${index}`;
}

function productsToBaseLines(products: Product[]): BespokeCartLineBase[] {
  return products.map((p, i) => ({
    id: lineCartId(p, i),
    productId: p.id,
    name: p.name,
    sku: p.sku ?? '',
    price: p.price,
    qty: p.quantity,
    variationId: p.variationId,
    unit: 'm',
    customizationDetails: p.customizationDetails ?? null,
    bespokeParentCartId: p.bespokeParentCartId,
    bespokeRole: p.bespokeRole,
    isBespokeInjected: p.isBespokeInjected,
    bespokeUsage: p.bespokeUsage,
    bespokeRefUnitPrice: p.bespokeRefUnitPrice,
  }));
}

function syncedLinesToProducts(synced: BespokeCartLineBase[], cartProducts: Product[]): Product[] {
  return synced.map((line) => {
    const existing = cartProducts.find((p, i) => lineCartId(p, i) === String(line.id));
    const isFabric = line.bespokeRole === 'fabric';
    return {
      id: String(line.productId),
      cartLineId: String(line.id),
      name: line.name,
      sku: line.sku,
      price: isFabric ? line.price : existing?.price ?? line.price,
      quantity: line.qty,
      variationId: line.variationId,
      variation: existing?.variation,
      total: (isFabric ? line.price : existing?.price ?? line.price) * line.qty,
      customizationDetails: line.customizationDetails ?? undefined,
      bespokeParentCartId: line.bespokeParentCartId,
      bespokeRole: line.bespokeRole,
      isBespokeInjected: line.isBespokeInjected,
      packingDetails: existing?.packingDetails,
      ...(line.bespokeUsage ? { bespokeUsage: line.bespokeUsage } : {}),
      ...(line.bespokeRefUnitPrice != null && line.bespokeRefUnitPrice > 0
        ? { bespokeRefUnitPrice: line.bespokeRefUnitPrice }
        : {}),
    };
  });
}

/** Append one fabric material to a CUSTOM parent line (keeps existing fabrics on that parent). */
export function appendFabricToParent(
  cartProducts: Product[],
  parentLine: Product,
  material: BespokeFabricMaterial,
  unitPrice: number,
): Product[] {
  const parentIdx = cartProducts.findIndex((p) => p === parentLine);
  const parentCartId = lineCartId(parentLine, parentIdx >= 0 ? parentIdx : 0);
  const baseLines = productsToBaseLines(cartProducts);
  const existing = hydrateFabricDraftsFromChildren(parentCartId, baseLines);
  const fabrics = [...existing, material];
  const { items: synced } = syncFabricChildLines(
    baseLines,
    parentCartId,
    fabrics,
    () => unitPrice,
    () => `fab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  return syncedLinesToProducts(synced, cartProducts);
}

/** Replace all fabrics on parent (Customize modal apply). */
export function applyFabricsToParent(
  cartProducts: Product[],
  parentLine: Product,
  fabrics: BespokeFabricMaterial[],
  resolvePrice: (f: BespokeFabricMaterial) => number,
  meta?: Record<string, unknown>,
): Product[] {
  const parentIdx = cartProducts.findIndex((p) => p === parentLine);
  const parentCartId = lineCartId(parentLine, parentIdx >= 0 ? parentIdx : 0);
  const baseLines = productsToBaseLines(cartProducts).map((line) => {
    if (String(line.id) !== parentCartId) return line;
    return {
      ...line,
      customizationDetails: (meta ?? line.customizationDetails) as Record<string, unknown> | null,
    };
  });
  const { items: synced } = syncFabricChildLines(
    baseLines,
    parentCartId,
    fabrics,
    resolvePrice,
    () => `fab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  return syncedLinesToProducts(synced, cartProducts);
}
