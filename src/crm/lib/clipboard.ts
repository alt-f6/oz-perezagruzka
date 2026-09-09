/**
 * Copies text to the clipboard resiliently across browsers. The async
 * Clipboard API is unavailable/blocked in several real cases (iOS WebKit
 * outside a user gesture, insecure origins, some in-app browsers), so we fall
 * back to a hidden-textarea + execCommand path with an iOS-specific selection
 * range. Returns whether the copy succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    // iOS Safari ignores .select() on non-editable-ish fields; an explicit
    // range + setSelectionRange is required for execCommand("copy") to work.
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
