/**
 * Global Input Configuration
 * Central config for keyboard types, validation, and Enter key behavior.
 */

const STORAGE_KEY = 'erp_mobile_input_config';

export type EnterKeyBehavior = 'focusNext' | 'submit';

export interface InputConfig {
  /** Enter key: focus next field or submit form */
  enterKeyBehavior: EnterKeyBehavior;
}

const DEFAULT_CONFIG: InputConfig = {
  enterKeyBehavior: 'focusNext',
};

export function getInputConfig(): InputConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<InputConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

export function setInputConfig(updates: Partial<InputConfig>): void {
  const current = getInputConfig();
  const next = { ...current, ...updates };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function setEnterKeyBehavior(behavior: EnterKeyBehavior): void {
  setInputConfig({ enterKeyBehavior: behavior });
}

/** HTML enterKeyHint for mobile keyboard – "Next" or "Done" label on Enter key */
export type EnterKeyHint = 'enter' | 'done' | 'go' | 'next' | 'search';

/**
 * Returns enterKeyHint for input elements.
 * Mobile numeric/text keyboard par Enter key par kya label dikhega.
 * - focusNext → "next" (Next)
 * - submit → "done" (Done)
 */
export function getEnterKeyHint(behavior?: EnterKeyBehavior, submitOnEnter?: boolean): EnterKeyHint {
  const effective = submitOnEnter ?? (behavior ?? getInputConfig().enterKeyBehavior) === 'submit';
  return effective ? 'done' : 'next';
}
