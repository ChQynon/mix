const ONLYSQ_URL = process.env.ONLYSQ_URL || "http://api.onlysq.ru/ai/v2";
const ONLYSQ_MODEL = process.env.ONLYSQ_MODEL || "mirexa";

export async function streamCompletion({ messages, onToken, model }) {
  const body = {
    model: (model || ONLYSQ_MODEL),
    request: {
      messages,
      stream: true,
    },
  };

  const response = await fetch(ONLYSQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`OnlySQ request failed: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let done = false;
  let buffer = "";
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const raw of lines) {
        const line = raw.trim().replace(/^data:\s*/, "");
        if (!line) continue;
        if (line === "[DONE]") return;
        try {
          const json = JSON.parse(line);
          const delta = json?.choices?.[0]?.delta;
          const token = delta?.content;
          if (token) onToken(token);
        } catch (_) {
          // ignore malformed chunk
        }
      }
    }
  }
}


