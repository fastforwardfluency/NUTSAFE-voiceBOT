const response = await fetch("https://gemini-api-bridge.your-subdomain.workers.dev", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data) // The data format from AI Studio
});
