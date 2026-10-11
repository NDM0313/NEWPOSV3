/**
 * Mobile variation library API (parity with web variationLibraryService).
 * Uses tables: variation_attributes, variation_attribute_values,
 *              product_variation_value_map.
 */

import { supabase } from '../lib/supabase';

export interface VariationAttribute {
  id: string;
  company_id: string;
  name: string;
  sort_order: number;
}

export interface VariationAttributeValue {
  id: string;
  attribute_id: string;
  value: string;
  hex_color?: string | null;
  sort_order: number;
}

export interface AttributeWithValues extends VariationAttribute {
  values: VariationAttributeValue[];
}

export async function listAttributes(companyId: string): Promise<AttributeWithValues[]> {
  const { data: attrs, error: attrErr } = await supabase
    .from('variation_attributes')
    .select('id, company_id, name, sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (attrErr) throw attrErr;
  if (!attrs || attrs.length === 0) return [];

  const ids = attrs.map((a) => a.id);
  const { data: values, error: valErr } = await supabase
    .from('variation_attribute_values')
    .select('id, attribute_id, value, hex_color, sort_order')
    .in('attribute_id', ids)
    .order('sort_order', { ascending: true })
    .order('value', { ascending: true });
  if (valErr) throw valErr;

  const byAttr: Record<string, VariationAttributeValue[]> = {};
  for (const v of (values || []) as VariationAttributeValue[]) {
    const arr = byAttr[v.attribute_id] || [];
    arr.push(v);
    byAttr[v.attribute_id] = arr;
  }
  return (attrs as VariationAttribute[]).map((a) => ({ ...a, values: byAttr[a.id] || [] }));
}

export async function ensureAttribute(companyId: string, name: string): Promise<VariationAttribute> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Attribute name is required');

  const { data: existing } = await supabase
    .from('variation_attributes')
    .select('id, company_id, name, sort_order')
    .eq('company_id', companyId)
    .ilike('name', trimmed)
    .maybeSingle();
  if (existing) return existing as VariationAttribute;

  const { data, error } = await supabase
    .from('variation_attributes')
    .insert({ company_id: companyId, name: trimmed })
    .select('id, company_id, name, sort_order')
    .single();
  if (error) throw error;
  return data as VariationAttribute;
}

export async function ensureValue(
  attributeId: string,
  value: string,
  hexColor?: string | null,
): Promise<VariationAttributeValue> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Value is required');

  const { data: existing } = await supabase
    .from('variation_attribute_values')
    .select('id, attribute_id, value, hex_color, sort_order')
    .eq('attribute_id', attributeId)
    .ilike('value', trimmed)
    .maybeSingle();
  if (existing) return existing as VariationAttributeValue;

  const payload: Record<string, unknown> = { attribute_id: attributeId, value: trimmed };
  if (hexColor) payload.hex_color = hexColor;

  const { data, error } = await supabase
    .from('variation_attribute_values')
    .insert(payload)
    .select('id, attribute_id, value, hex_color, sort_order')
    .single();
  if (error) throw error;
  return data as VariationAttributeValue;
}

export async function setVariationValues(variationId: string, valueIds: string[]): Promise<void> {
  await supabase.from('product_variation_value_map').delete().eq('variation_id', variationId);
  if (valueIds.length === 0) return;
  const rows = valueIds.map((vid) => ({ variation_id: variationId, value_id: vid }));
  const { error } = await supabase.from('product_variation_value_map').insert(rows);
  if (error) throw error;
}
