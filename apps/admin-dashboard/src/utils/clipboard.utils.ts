export function copyToClipboard(text: string, onCopied?: () => void): void {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onCopied).catch(() => fallbackCopy(text, onCopied));
  } else {
    fallbackCopy(text, onCopied);
  }
}

function fallbackCopy(text: string, onCopied?: () => void): void {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  try { document.execCommand('copy'); onCopied?.(); } catch { /* ignore */ }
  document.body.removeChild(el);
}
