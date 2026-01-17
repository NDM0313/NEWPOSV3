/**
 * Style Helpers for Design Token Migration
 * 
 * These utilities help migrate from hardcoded colors to design tokens
 */

/**
 * Get background color from token
 */
export const getBgColor = (variant: 'primary' | 'secondary' | 'tertiary' | 'card' | 'panel' = 'primary') => {
  const tokens = {
    primary: 'var(--color-bg-primary)',
    secondary: 'var(--color-bg-secondary)',
    tertiary: 'var(--color-bg-tertiary)',
    card: 'var(--color-bg-card)',
    panel: 'var(--color-bg-panel)',
  };
  return tokens[variant];
};

/**
 * Get text color from token
 */
export const getTextColor = (variant: 'primary' | 'secondary' | 'tertiary' | 'disabled' = 'primary') => {
  const tokens = {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    tertiary: 'var(--color-text-tertiary)',
    disabled: 'var(--color-text-disabled)',
  };
  return tokens[variant];
};

/**
 * Get border color from token
 */
export const getBorderColor = (variant: 'primary' | 'secondary' | 'focus' = 'primary') => {
  const tokens = {
    primary: 'var(--color-border-primary)',
    secondary: 'var(--color-border-secondary)',
    focus: 'var(--color-border-focus)',
  };
  return tokens[variant];
};

/**
 * Get hover background color
 */
export const getHoverBg = () => 'var(--color-hover-bg)';

/**
 * Get selected background color
 */
export const getSelectedBg = () => 'var(--color-selected-bg)';

/**
 * Get semantic color (primary, success, warning, error)
 */
export const getSemanticColor = (type: 'primary' | 'success' | 'warning' | 'error' = 'primary') => {
  const tokens = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };
  return tokens[type];
};

/**
 * Create inline style object for background
 */
export const bgStyle = (variant: 'primary' | 'secondary' | 'tertiary' | 'card' | 'panel' = 'primary') => ({
  backgroundColor: getBgColor(variant),
});

/**
 * Create inline style object for text color
 */
export const textStyle = (variant: 'primary' | 'secondary' | 'tertiary' | 'disabled' = 'primary') => ({
  color: getTextColor(variant),
});

/**
 * Create inline style object for border
 */
export const borderStyle = (variant: 'primary' | 'secondary' | 'focus' = 'primary') => ({
  borderColor: getBorderColor(variant),
});

/**
 * Create combined style object
 */
export const createStyle = (options: {
  bg?: 'primary' | 'secondary' | 'tertiary' | 'card' | 'panel';
  text?: 'primary' | 'secondary' | 'tertiary' | 'disabled';
  border?: 'primary' | 'secondary' | 'focus';
  borderRadius?: string;
}) => {
  const style: React.CSSProperties = {};
  
  if (options.bg) {
    style.backgroundColor = getBgColor(options.bg);
  }
  if (options.text) {
    style.color = getTextColor(options.text);
  }
  if (options.border) {
    style.borderColor = getBorderColor(options.border);
  }
  if (options.borderRadius) {
    style.borderRadius = options.borderRadius;
  }
  
  return style;
};

/**
 * Hover event handlers that use design tokens
 */
export const createHoverHandlers = (element: HTMLElement, baseStyle: React.CSSProperties) => ({
  onMouseEnter: () => {
    if (element.style) {
      element.style.backgroundColor = getHoverBg();
      element.style.color = getTextColor('primary');
    }
  },
  onMouseLeave: () => {
    if (element.style) {
      Object.assign(element.style, baseStyle);
    }
  },
});
