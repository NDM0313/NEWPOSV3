import { dinChinaUuid, legacyContactNote, SOURCE_SYSTEM } from './dinChinaLegacyMap.js';
import { legacyAccountConfigById, mapLegacyPaymentMethod } from './mapLegacyPaymentMethod.js';

export function normalizeName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function normalizePhone(phone) {
  return String(phone || '')
    .replace(/[\s\-()+]/g, '')
    .replace(/^0+/, '')
    .trim();
}

function accountNameNorm(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildContactMatchPlan(contacts, legacyContacts, existingDbContacts, walkingCustomerId) {
  const plan = [];
  const usedDbIds = new Set();

  for (const leg of legacyContacts) {
    const legacyId = leg.legacyContactId;
    const deterministicId = dinChinaUuid('contacts', legacyId);

    if (legacyId === 1 && walkingCustomerId) {
      plan.push({
        legacyContactId: legacyId,
        action: 'reuse',
        reason: 'walking_customer',
        newContactId: walkingCustomerId,
        name: leg.name,
        type: leg.type,
      });
      usedDbIds.add(walkingCustomerId);
      continue;
    }

    const existingById = existingDbContacts.find((c) => c.id === deterministicId);
    if (existingById) {
      plan.push({
        legacyContactId: legacyId,
        action: 'reuse',
        reason: 'deterministic_id',
        newContactId: existingById.id,
        name: existingById.name,
        type: existingById.type,
      });
      usedDbIds.add(existingById.id);
      continue;
    }

    const phone = normalizePhone(leg.phone);
    const nameNorm = normalizeName(leg.name);
    let match = null;
    if (phone) {
      match = existingDbContacts.find(
        (c) =>
          !usedDbIds.has(c.id) &&
          (normalizePhone(c.phone) === phone || normalizePhone(c.mobile) === phone),
      );
    }
    if (!match && nameNorm) {
      match = existingDbContacts.find(
        (c) => !usedDbIds.has(c.id) && normalizeName(c.name) === nameNorm,
      );
    }
    if (match) {
      plan.push({
        legacyContactId: legacyId,
        action: 'reuse',
        reason: phone ? 'phone' : 'name',
        newContactId: match.id,
        name: match.name,
        type: match.type,
      });
      usedDbIds.add(match.id);
      continue;
    }

    plan.push({
      legacyContactId: legacyId,
      action: 'create',
      reason: 'not_found',
      newContactId: deterministicId,
      name: leg.name,
      phone: leg.phone,
      type: leg.type,
      notes: legacyContactNote(legacyId),
    });
  }

  return plan;
}

export function buildProductMatchPlan(products, existingProducts, existingVariations) {
  const plan = [];
  const productBySku = new Map();
  const productByName = new Map();
  for (const p of existingProducts) {
    const sku = String(p.sku || '').trim().toLowerCase();
    if (sku) productBySku.set(sku, p);
    const nm = normalizeName(p.name);
    if (nm) productByName.set(nm, p);
  }

  const varBySku = new Map();
  for (const v of existingVariations) {
    const sku = String(v.sku || '').trim().toLowerCase();
    if (sku) varBySku.set(sku, v);
  }

  for (const leg of products) {
    const parentId = dinChinaUuid('products', leg.legacyProductId);
    const varId = dinChinaUuid('product_variations', leg.legacyVariationId);
    const skuKey = String(leg.sku || '').trim().toLowerCase();
    const nameKey = normalizeName(leg.productName);

    const existingParent =
      existingProducts.find((p) => p.id === parentId) ||
      (skuKey ? productBySku.get(skuKey) : null) ||
      (nameKey ? productByName.get(nameKey) : null);

    const existingVar =
      existingVariations.find((v) => v.id === varId) || (skuKey ? varBySku.get(skuKey) : null);

    if (existingParent && existingVar) {
      plan.push({
        legacyProductId: leg.legacyProductId,
        legacyVariationId: leg.legacyVariationId,
        action: 'reuse',
        productId: existingParent.id,
        variationId: existingVar.id,
        sku: leg.sku,
        name: leg.productName,
      });
    } else if (existingParent && !existingVar) {
      plan.push({
        legacyProductId: leg.legacyProductId,
        legacyVariationId: leg.legacyVariationId,
        action: 'create_variation',
        productId: existingParent.id,
        variationId: varId,
        sku: leg.sku,
        name: leg.productName,
      });
    } else {
      plan.push({
        legacyProductId: leg.legacyProductId,
        legacyVariationId: leg.legacyVariationId,
        action: 'create',
        productId: parentId,
        variationId: varId,
        sku: leg.sku,
        name: leg.productName,
      });
    }
  }

  return plan;
}

function isParentOrGroupAccount(a) {
  if (!a) return false;
  const parentHeaders = new Set(['1050', '1060', '1070', '4050', '2090', '3090', '6090', '1090']);
  if (a.is_group === true) return true;
  const code = String(a.code || '').trim();
  return parentHeaders.has(code);
}

export function buildAccountMatchPlan(legacyAccountIds, existingAccounts) {
  const byName = new Map();
  const byCode = new Map();
  for (const a of existingAccounts) {
    byName.set(accountNameNorm(a.name), a);
    if (a.code) byCode.set(String(a.code).trim(), a);
  }

  return legacyAccountIds.map((legacyId) => {
    const cfg = legacyAccountConfigById(legacyId);
    if (!cfg) {
      return {
        legacyAccountId: legacyId,
        action: 'missing_config',
        newAccountId: null,
        name: null,
      };
    }
    const nameKey = accountNameNorm(cfg.newName);
    const match = byName.get(nameKey) || (cfg.suggestedCode ? byCode.get(cfg.suggestedCode) : null);
    if (match) {
      if (isParentOrGroupAccount(match)) {
        return {
          legacyAccountId: legacyId,
          action: 'blocked_parent',
          newAccountId: match.id,
          name: match.name,
          type: match.type,
          code: match.code,
          reason: 'matched account is parent/group header',
        };
      }
      return {
        legacyAccountId: legacyId,
        action: 'reuse',
        newAccountId: match.id,
        name: match.name,
        type: match.type,
        code: match.code,
        is_group: match.is_group === true,
      };
    }
    return {
      legacyAccountId: legacyId,
      action: 'create',
      newAccountId: dinChinaUuid('accounts', legacyId),
      name: cfg.newName,
      type: cfg.suggestedType,
      code: cfg.suggestedCode,
      is_group: false,
    };
  });
}

export function resolvePaymentAccountId(paymentRow, accountPlan) {
  let legacyAcctId =
    paymentRow.account_id != null && String(paymentRow.account_id).trim() !== ''
      ? Number(paymentRow.account_id)
      : null;

  if (legacyAcctId == null && paymentRow.method) {
    const mapped = mapLegacyPaymentMethod(paymentRow.method);
    if (mapped.defaultLegacyAccountId != null) {
      legacyAcctId = mapped.defaultLegacyAccountId;
    }
  }

  if (legacyAcctId != null) {
    const hit = accountPlan.find((a) => a.legacyAccountId === legacyAcctId);
    if (hit?.newAccountId && hit.action !== 'blocked_parent') {
      return {
        legacyAccountId: legacyAcctId,
        newAccountId: hit.newAccountId,
        ok: true,
        resolvedVia: paymentRow.account_id ? 'row' : 'method_default',
      };
    }
    return { legacyAccountId: legacyAcctId, newAccountId: null, ok: false };
  }
  return { legacyAccountId: null, newAccountId: null, ok: false, unmapped: true };
}

export function summarizePlanActions(plan, actionKey = 'action') {
  const summary = { create: 0, reuse: 0, other: 0 };
  for (const p of plan) {
    const a = p[actionKey];
    if (a === 'create' || a === 'create_variation') summary.create++;
    else if (a === 'reuse') summary.reuse++;
    else summary.other++;
  }
  return summary;
}
