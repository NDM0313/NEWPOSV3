/**
 * UI Formatting Utilities
 * 
 * These helpers ensure consistent, human-readable display across the ERP system.
 * UUIDs should NEVER appear in the UI - only names and short codes.
 */

// UUID regex pattern for detection
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string looks like a UUID
 */
export const isUUID = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return UUID_PATTERN.test(value);
};

/**
 * Format branch/location for UI display
 * 
 * Rules:
 * - Never show UUID
 * - Show only branch name (not code unless explicitly needed)
 * 
 * @param branch - Branch object or string
 * @returns Human-readable branch name
 */
export const formatBranchLabel = (
  branch: { id?: string; code?: string; name?: string } | string | null | undefined
): string => {
  if (!branch) return '—';
  
  // If it's a string
  if (typeof branch === 'string') {
    // If it's a UUID, don't display it
    if (isUUID(branch)) return '—';
    // If it already contains formatted name (e.g., "BR-001 | Main Branch"), extract just the name
    if (branch.includes('|')) {
      const parts = branch.split('|');
      return parts[parts.length - 1].trim() || '—';
    }
    // Return as-is if it's already a name
    return branch;
  }
  
  // If it's an object
  if (typeof branch === 'object') {
    // Priority: name > code (but not UUID)
    if (branch.name) return branch.name;
    if (branch.code && !isUUID(branch.code)) return branch.code;
  }
  
  return '—';
};

/**
 * Format branch with code (for cases where code is explicitly needed)
 * 
 * @param branch - Branch object
 * @returns "BR-001 | Main Branch" format or just name
 */
export const formatBranchWithCode = (
  branch: { id?: string; code?: string; name?: string } | null | undefined
): string => {
  if (!branch) return '—';
  
  const name = branch.name || '';
  const code = branch.code && !isUUID(branch.code) ? branch.code : '';
  
  if (code && name) {
    return `${code} | ${name}`;
  }
  return name || '—';
};

/**
 * Format customer for UI display
 * 
 * Rules:
 * - Never show UUID
 * - Show customer name only (or with short code if available)
 * 
 * @param customer - Customer object or string
 * @param options - Display options
 * @returns Human-readable customer label
 */
export const formatCustomerLabel = (
  customer: { id?: string; code?: string; name?: string; customer_code?: string } | string | null | undefined,
  options: { includeCode?: boolean } = {}
): string => {
  if (!customer) return 'Walk-in Customer';
  
  // If it's a string
  if (typeof customer === 'string') {
    // If it's a UUID, don't display it
    if (isUUID(customer)) return 'Walk-in Customer';
    return customer;
  }
  
  // If it's an object
  if (typeof customer === 'object') {
    const name = customer.name || 'Walk-in Customer';
    const code = customer.code || customer.customer_code;
    
    // Include code only if requested and code is not a UUID
    if (options.includeCode && code && !isUUID(code)) {
      return `${name} (${code})`;
    }
    
    return name;
  }
  
  return 'Walk-in Customer';
};

/**
 * Format supplier for UI display
 * 
 * @param supplier - Supplier object or string
 * @param options - Display options
 * @returns Human-readable supplier label
 */
export const formatSupplierLabel = (
  supplier: { id?: string; code?: string; name?: string; supplier_code?: string } | string | null | undefined,
  options: { includeCode?: boolean } = {}
): string => {
  if (!supplier) return 'Unknown Supplier';
  
  // If it's a string
  if (typeof supplier === 'string') {
    if (isUUID(supplier)) return 'Unknown Supplier';
    return supplier;
  }
  
  // If it's an object
  if (typeof supplier === 'object') {
    const name = supplier.name || 'Unknown Supplier';
    const code = supplier.code || supplier.supplier_code;
    
    if (options.includeCode && code && !isUUID(code)) {
      return `${name} (${code})`;
    }
    
    return name;
  }
  
  return 'Unknown Supplier';
};

/**
 * Format user for UI display
 * 
 * @param user - User object or string
 * @returns Human-readable user label
 */
export const formatUserLabel = (
  user: { id?: string; user_code?: string; full_name?: string; name?: string } | string | null | undefined
): string => {
  if (!user) return 'Unknown';
  
  if (typeof user === 'string') {
    if (isUUID(user)) return 'Unknown';
    return user;
  }
  
  if (typeof user === 'object') {
    return user.full_name || user.name || 'Unknown';
  }
  
  return 'Unknown';
};

/**
 * Format any ID field for display - returns empty or placeholder if UUID
 * 
 * @param value - Any string value
 * @param placeholder - Placeholder if value is UUID or empty
 * @returns Safe display value
 */
export const formatIdForDisplay = (
  value: string | null | undefined,
  placeholder: string = '—'
): string => {
  if (!value) return placeholder;
  if (isUUID(value)) return placeholder;
  return value;
};

/**
 * Clean a pre-formatted branch string (remove code prefix if present)
 * 
 * Input: "BR-001 | Main Branch" → Output: "Main Branch"
 * Input: "Main Branch" → Output: "Main Branch"
 * Input: "f88a022f-d159-404f-..." → Output: "—"
 */
export const cleanBranchDisplay = (value: string | null | undefined): string => {
  if (!value) return '—';
  if (isUUID(value)) return '—';
  
  // If it contains pipe separator, take the part after it
  if (value.includes('|')) {
    const parts = value.split('|');
    return parts[parts.length - 1].trim() || '—';
  }
  
  return value;
};
