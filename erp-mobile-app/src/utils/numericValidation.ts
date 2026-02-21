/**
 * Numeric input validation utilities
 * Reusable across all modules.
 */

export interface NumericValidationOptions {
  allowDecimal?: boolean;
  allowNegative?: boolean;
  min?: number;
  max?: number;
  maxDecimals?: number;
}

/**
 * Regex for numeric input (reject invalid chars as user types)
 * - allowDecimal: allow one decimal point
 * - allowNegative: allow leading minus
 */
export function getNumericPattern(options: NumericValidationOptions): RegExp {
  const { allowDecimal = false, allowNegative = false } = options;
  if (allowNegative && allowDecimal) {
    return /^-?\d*\.?\d*$/;
  }
  if (allowNegative) {
    return /^-?\d*$/;
  }
  if (allowDecimal) {
    return /^\d*\.?\d*$/;
  }
  return /^\d*$/;
}

/**
 * Validate and sanitize numeric string
 * Returns sanitized value or empty string if invalid
 */
export function validateNumericInput(
  value: string,
  options: NumericValidationOptions
): { valid: boolean; sanitized: string; parsed?: number } {
  const { allowDecimal = false, allowNegative = false, min, max, maxDecimals } = options;
  const pattern = getNumericPattern(options);

  if (value === '' || value === '-') {
    return { valid: true, sanitized: value };
  }

  if (!pattern.test(value)) {
    return { valid: false, sanitized: '' };
  }

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return { valid: true, sanitized: value };
  }

  if (!allowNegative && parsed < 0) {
    return { valid: false, sanitized: '' };
  }

  if (min != null && parsed < min) {
    return { valid: false, sanitized: String(min) };
  }

  if (max != null && parsed > max) {
    return { valid: false, sanitized: String(max) };
  }

  if (maxDecimals != null && allowDecimal) {
    const parts = value.split('.');
    if (parts[1] && parts[1].length > maxDecimals) {
      return { valid: false, sanitized: parsed.toFixed(maxDecimals) };
    }
  }

  return { valid: true, sanitized: value, parsed };
}
