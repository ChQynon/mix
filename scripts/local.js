import { bot } from "../api/telegram.js";

async function main() {
  try {
    // Ensure webhook is cleared for polling mode
    await bot.telegram.deleteWebhook().catch(() => {});
    await bot.launch({ dropPendingUpdates: true });
    console.log("Bot started in polling mode.");

    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (e) {
    console.error("Failed to start bot:", e);
    process.exit(1);
  }
}

main();


