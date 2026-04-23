/**
 * Variation Library Service (web)
 *
 * Company-level reusable attributes (Color, Size, ...) and values.
 * Tables: variation_attributes, variation_attribute_values.
 *
 * Designed to match the mobile `variationLibrary` api so the UI layer can
 * share mental model. All reads/writes honor RLS (users see/change only their
 * company's rows).
 */

import { supabase } from '@/lib/supabase';

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

export const variationLibraryService = {
  /** List all attributes (with values) for a company. */
  async listAttributes(companyId: string): Promise<AttributeWithValues[]> {
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

    const valsByAttr: Record<string, VariationAttributeValue[]> = {};
    for (const v of values || []) {
      const arr = valsByAttr[v.attribute_id] || [];
      arr.push(v as VariationAttributeValue);
      valsByAttr[v.attribute_id] = arr;
    }
    return attrs.map((a) => ({ ...(a as VariationAttribute), values: valsByAttr[a.id] || [] }));
  },

  /** Find an existing attribute by case-insensitive name or create it. */
  async ensureAttribute(companyId: string, name: string): Promise<VariationAttribute> {
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
  },

  /** Find an existing value or create it (dedupe case-insensitively). */
  async ensureValue(attributeId: string, value: string, hexColor?: string | null): Promise<VariationAttributeValue> {
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
  },

  /** Replace the value-map for a single product variation. */
  async setVariationValues(variationId: string, valueIds: string[]): Promise<void> {
    await supabase.from('product_variation_value_map').delete().eq('variation_id', variationId);
    if (valueIds.length === 0) return;
    const rows = valueIds.map((vid) => ({ variation_id: variationId, value_id: vid }));
    const { error } = await supabase.from('product_variation_value_map').insert(rows);
    if (error) throw error;
  },

  async deleteValue(valueId: string): Promise<void> {
    const { error } = await supabase.from('variation_attribute_values').delete().eq('id', valueId);
    if (error) throw error;
  },

  async deleteAttribute(attributeId: string): Promise<void> {
    const { error } = await supabase.from('variation_attributes').delete().eq('id', attributeId);
    if (error) throw error;
  },
};
