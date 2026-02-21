/**
 * Global Input Keyboard Configuration
 * Applies inputMode and enterKeyHint to every input element for correct mobile keyboard behavior:
 * - Numeric inputs → num pad (inputMode: decimal/numeric)
 * - Text inputs → regular keyboard (inputMode: text)
 * - Enter key → Next/Done for form flow
 */

function applyInputAttributes(el: HTMLInputElement | HTMLTextAreaElement) {
  if (el.dataset.keyboardApplied === 'true') return;
  if (el.getAttribute('inputMode') === 'none' || el.dataset.skipKeyboardPatch === 'true') return;
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  const step = el.getAttribute('step');
  const hasNumericHint = el.hasAttribute('data-input-numeric') || el.getAttribute('inputMode') === 'decimal' || el.getAttribute('inputMode') === 'numeric';

  if (tag === 'textarea') {
    el.setAttribute('inputMode', 'text');
    el.setAttribute('enterKeyHint', 'done');
    el.dataset.keyboardApplied = 'true';
    return;
  }

  if (type === 'email') {
    el.setAttribute('inputMode', 'email');
    el.setAttribute('enterKeyHint', 'next');
    el.dataset.keyboardApplied = 'true';
    return;
  }

  if (type === 'tel') {
    el.setAttribute('inputMode', 'tel');
    el.setAttribute('enterKeyHint', 'next');
    el.dataset.keyboardApplied = 'true';
    return;
  }

  if (type === 'password') {
    el.setAttribute('enterKeyHint', 'next');
    el.dataset.keyboardApplied = 'true';
    return;
  }

  if (type === 'date' || type === 'datetime-local') {
    el.setAttribute('enterKeyHint', 'next');
    el.dataset.keyboardApplied = 'true';
    return;
  }

  if (type === 'number' || hasNumericHint) {
    const stepVal = step ? parseFloat(step) : 1;
    const hasDecimal = stepVal > 0 && stepVal < 1;
    el.setAttribute('inputMode', hasDecimal ? 'decimal' : 'numeric');
    el.setAttribute('enterKeyHint', 'next');
    el.dataset.keyboardApplied = 'true';
    return;
  }

  // Text, search, url, etc.
  el.setAttribute('inputMode', 'text');
  el.setAttribute('enterKeyHint', 'next');
  el.dataset.keyboardApplied = 'true';
}

function patchInputs(root: Element) {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input, textarea'
  ).forEach(applyInputAttributes);
}

export function initInputKeyboard() {
  const root = document.getElementById('root');
  if (!root) return;

  patchInputs(root);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length) {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
              applyInputAttributes(node);
            }
            patchInputs(node);
          }
        });
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}
