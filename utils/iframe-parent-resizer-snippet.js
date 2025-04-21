// Add this script to the parent page that embeds the iframe

// Replace 'my-iframe' with your iframe's id if different
const iframe = document.getElementById("my-iframe");

window.addEventListener("message", (event) => {
  // Optionally, check event.origin for security
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
