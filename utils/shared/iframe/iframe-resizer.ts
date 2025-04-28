/**
 * iframe-resizer.ts
 * Script to handle dynamic iframe resizing for embedded content.
 * 
 * @module iframe-resizer
 */

/**
 * Sends the current document height to the parent window.
 * Should be called whenever the content size changes.
 */
export function sendHeightToParent(): void {
  const height = document.documentElement.scrollHeight;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'resize', height }, '*');
  }
}

// Initialize resizer when this module is imported
if (typeof window !== 'undefined') {
  // Send height on load
  window.addEventListener('load', sendHeightToParent);

  // Send height on any content changes
  const observer = new MutationObserver(sendHeightToParent);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  // Send height on any dynamic content updates
  window.addEventListener('resize', sendHeightToParent);
} 