Telegram Role-Play Bot (Vercel-ready)

Features
- Inline buttons: role selection, clear memory, help
- Per-chat memory (Upstash Redis if configured, else in-memory)
- Streaming responses from OnlySQ API (model Mirexa)
- Auto webhook setup endpoint for Vercel

Deploy
1. Create a bot via BotFather and get TELEGRAM_BOT_TOKEN.
2. (Optional) Create Upstash Redis DB and copy REST URL/TOKEN.
3. Push this repo to GitHub and import into Vercel.
4. In Vercel Project Settings → Environment Variables add:
   - TELEGRAM_BOT_TOKEN = your token
   - ONLYSQ_URL = http://api.onlysq.ru/ai/v2 (optional; default provided)
   - ONLYSQ_MODEL = Mirexa (optional)
   - UPSTASH_REDIS_REST_URL = (optional)
   - UPSTASH_REDIS_REST_TOKEN = (optional)
5. Open https://<your-project>.vercel.app/api/setup once to set webhook.

Local dev
1) npm i
2) npx vercel dev
Use a tunnel (cloudflared/ngrok) to expose /api/telegram to Telegram.

Commands
- /start — greeting + menu
- Inline buttons: "🎭 Выбрать роль", "🧠 Очистить память", "ℹ️ Как пользоваться"

Notes
- Memory persists 7 days in Redis. In-memory resets on deploy.
- Edit roles in api/telegram.js under the roles array.

