// Replace the long Google URL with your Worker's URL
const response = await fetch("https://gemini-api-bridge.your-subdomain.workers.dev", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: userInput }] }]
  })
});
