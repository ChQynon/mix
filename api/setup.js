// Use the same bot token as in telegram.js for consistency on Vercel
const BOT_TOKEN = "8276408983:AAHXw_G0ItyD61sg_-vQ6RXODPdrFwcfXY0";

export default async function handler(req, res) {
  if (!BOT_TOKEN) {
    return res.status(400).json({ ok: false, error: "Missing TELEGRAM_BOT_TOKEN" });
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const baseUrl = `${protocol}://${host}`;
  const webhookUrl = `${baseUrl}/api/telegram`;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
  });
  const json = await response.json().catch(() => ({}));
  res.status(200).json({ ok: true, requested: { url: webhookUrl }, telegram: json });
}


