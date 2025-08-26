import { Telegraf, Markup } from "telegraf";
import { streamCompletion } from "./_lib/onlysq.js";
import { getHistory, setHistory, clearHistory, getRole, setRole, setPendingRole, isPendingRole, getModel, setModel } from "./_lib/store.js";

const BOT_TOKEN = "8276408983:AAHXw_G0ItyD61sg_-vQ6RXODPdrFwcfXY0";
const bot = new Telegraf(BOT_TOKEN);

function sanitizeChunk(text) {
  if (!text) return text;
  // Remove common provider/model attributions and phrases
  const blocked = [
    /onlysq/gi,
    /mirexa/gi,
    /openai/gi,
    /anthropic/gi,
    /chatgpt/gi,
    /gpt-\d+/gi,
    /thanks to/gi,
    /powered by/gi,
  ];
  let out = text;
  for (const rx of blocked) out = out.replace(rx, "");
  return out;
}

function mainMenu(role, model) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🎭 Выбрать роль", "set_role")],
    [Markup.button.callback("🧠 Очистить память", "clear")],
    [
      Markup.button.callback(`Mirexa${model === "mirexa" ? " ✅" : ""}`, "model_mirexa"),
      Markup.button.callback(`Evil${model === "evil" ? " ✅" : ""}`, "model_evil"),
    ],
    [Markup.button.callback(`Текущая роль: ${role}`, "noop")],
  ]);
}

async function editTextMarkdown(ctx, reply, text) {
  try {
    await ctx.telegram.editMessageText(
      reply.chat.id,
      reply.message_id,
      undefined,
      text,
      { parse_mode: "Markdown" }
    );
  } catch (_) {}
}

bot.start(async (ctx) => {
  const role = await getRole(ctx.chat.id);
  const model = await getModel(ctx.chat.id);
  await ctx.reply(
    "Привет! Я ролевой ИИ-бот. Задай сцену, выбирай роль и общайся. Сообщения запоминаю до очистки.",
    mainMenu(role, model)
  );
});

bot.command("menu", async (ctx) => {
  const role = await getRole(ctx.chat.id);
  const model = await getModel(ctx.chat.id);
  await ctx.reply("Меню:", mainMenu(role, model));
});

bot.action("noop", (ctx) => ctx.answerCbQuery(""));

bot.action("clear", async (ctx) => {
  await clearHistory(ctx.chat.id);
  await ctx.answerCbQuery("Память очищена");
  const role = await getRole(ctx.chat.id);
  const model = await getModel(ctx.chat.id);
  await ctx.editMessageReplyMarkup(mainMenu(role, model).reply_markup).catch(() => {});
});

bot.action("set_role", async (ctx) => {
  await setPendingRole(ctx.chat.id, true);
  await ctx.answerCbQuery();
  await ctx.reply("Введи текстом, какой ролью я должен быть (любая фраза). Например: 'Харизматичный детектив 80-х'.");
});

bot.command("role", async (ctx) => {
  const text = ctx.message.text || "";
  const arg = text.replace(/^\/role\s*/i, "").trim();
  if (!arg) {
    await ctx.reply("Использование: /role <твоя_роль>");
    return;
  }
  await setRole(ctx.chat.id, arg);
  await setPendingRole(ctx.chat.id, false);
  const model = await getModel(ctx.chat.id);
  await ctx.reply(`Роль установлена: ${arg}`, mainMenu(arg, model));
});

bot.action("model_mirexa", async (ctx) => {
  await setModel(ctx.chat.id, "mirexa");
  await ctx.answerCbQuery("Модель: Mirexa");
  const role = await getRole(ctx.chat.id);
  const model = await getModel(ctx.chat.id);
  try {
    await ctx.editMessageReplyMarkup(mainMenu(role, model).reply_markup);
  } catch (_) {}
});

bot.action("model_evil", async (ctx) => {
  await setModel(ctx.chat.id, "evil");
  await ctx.answerCbQuery("Модель: Evil");
  const role = await getRole(ctx.chat.id);
  const model = await getModel(ctx.chat.id);
  try {
    await ctx.editMessageReplyMarkup(mainMenu(role, model).reply_markup);
  } catch (_) {}
});

bot.on("message", async (ctx) => {
  if (!ctx.message || typeof ctx.message.text !== "string") return;
  const userText = ctx.message.text.trim();
  if (!userText) return;

  const chatId = ctx.chat.id;
  // If waiting for a custom role, treat this message as the role text
  if (await isPendingRole(chatId)) {
    await setRole(chatId, userText);
    await setPendingRole(chatId, false);
    const model = await getModel(chatId);
    await ctx.reply(`Роль установлена: ${userText}`, mainMenu(userText, model));
    return;
  }

  const role = await getRole(chatId);
  const model = await getModel(chatId);
  const history = await getHistory(chatId);

  const systemPrompt = `You are a role-playing bot. Stay in character as ${role}. Keep responses concise and interactive. Speak Russian by default. Never mention or attribute any providers, models, APIs, or tools used to generate responses.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userText },
  ];

  const reply = await ctx.reply("🤖 …");
  let generated = "";
  let interval = null;
  let wordBuffer = [];
  let carry = "";
  try {
    await streamCompletion({
      messages,
      model,
      onToken: async (token) => {
        const safe = sanitizeChunk(token);
        if (!safe) return;
        // accumulate and split into words
        carry += safe;
        const parts = carry.split(/(\s+)/);
        carry = parts.pop() || ""; // keep last partial
        for (const p of parts) {
          // treat sequences: words and whitespace; we only pace words, but keep whitespace attached to preceding word
          if (/\s+/.test(p)) {
            if (wordBuffer.length) wordBuffer[wordBuffer.length - 1] += p;
            else generated += p;
          } else if (p.length) {
            wordBuffer.push(p);
          }
        }

        if (!interval) {
          interval = setInterval(async () => {
            if (wordBuffer.length === 0 && carry === "") return;
            const next = wordBuffer.shift();
            if (typeof next === "string") generated += next;
            await editTextMarkdown(ctx, reply, generated);
          }, 250); // 4 words per second
        }
      },
    });

    if (generated.length === 0) generated = "(пустой ответ)";
    if (interval) clearInterval(interval);
    // flush remaining buffered words and any carry
    if (wordBuffer.length || carry) {
      generated += wordBuffer.join("") + carry;
      wordBuffer = [];
      carry = "";
    }
    await editTextMarkdown(ctx, reply, generated);

    const updatedHistory = [...history, { role: "user", content: userText }, { role: "assistant", content: generated }];
    await setHistory(chatId, updatedHistory);
  } catch (err) {
    const msg = `Ошибка ИИ: ${err.message || err}`;
    try {
      await ctx.telegram.editMessageText(reply.chat.id, reply.message_id, undefined, msg);
    } catch (_) {
      await ctx.reply(msg);
    }
  }
});

// Vercel handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, message: "Telegram webhook endpoint" });
  }
  try {
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: true });
  }
}

// Export bot for local polling mode
export { bot };


