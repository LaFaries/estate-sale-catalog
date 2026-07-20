// Netlify Function: /.netlify/functions/scan
// Securely proxies the AI photo scan to the Anthropic API.
// The API key is read from the ANTHROPIC_API_KEY environment variable
// (set it in Netlify: Site configuration > Environment variables).
// The key never appears in the website code or in the visitor's browser.

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { error: "Server is missing the ANTHROPIC_API_KEY environment variable. Add it in Netlify site settings, then redeploy." },
      500
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { imageBase64, mediaType, prompt } = body || {};
  if (!imageBase64 || !prompt) {
    return json({ error: "Missing image or prompt" }, 400);
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64
              }
            },
            { type: "text", text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || ("Anthropic API returned " + response.status);
      return json({ error: msg }, response.status);
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return json({ text });
  } catch (err) {
    return json({ error: "Scan request failed: " + err.message }, 502);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
