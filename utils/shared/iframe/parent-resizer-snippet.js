/**
 * Parent iframe resizer script
 * Add this script to the parent page that embeds the iframe.
 * It receives messages from the iframe to dynamically adjust its height.
 *
 * @module parent-resizer-snippet
 */

// Replace 'my-iframe' with your iframe's id if different
const iframe = document.getElementById("my-iframe");

/**
 * Event listener for postMessage from the iframe.
 * Adjusts the iframe height based on content.
 */
window.addEventListener("message", (event) => {
  // Optionally, check event.origin for security
  // if (event.origin !== "https://your-trusted-domain.com") return;

  if (
    event.data &&
    typeof event.data === "object" &&
    event.data.type === "resize" &&
    typeof event.data.height === "number"
  ) {
    if (iframe) {
      iframe.style.height = event.data.height + "px";
    }
  }
});
