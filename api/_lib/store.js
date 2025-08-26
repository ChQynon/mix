import { Redis } from "@upstash/redis";

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient = null;
if (upstashUrl && upstashToken) {
  redisClient = new Redis({ url: upstashUrl, token: upstashToken });
}

const inMemory = new Map();

function makeKey(chatId) {
  return `tg:chat:${chatId}:history`;
}

export async function getHistory(chatId) {
  const key = makeKey(chatId);
  if (redisClient) {
    const data = await redisClient.get(key);
    return Array.isArray(data) ? data : [];
  }
  return inMemory.get(key) || [];
}

export async function setHistory(chatId, history) {
  const key = makeKey(chatId);
  if (redisClient) {
    await redisClient.set(key, history, { ex: 60 * 60 * 24 * 7 });
    return;
  }
  inMemory.set(key, history);
}

export async function clearHistory(chatId) {
  const key = makeKey(chatId);
  if (redisClient) {
    await redisClient.del(key);
    return;
  }
  inMemory.delete(key);
}

function roleKey(chatId) {
  return `tg:chat:${chatId}:role`;
}

export async function getRole(chatId) {
  const key = roleKey(chatId);
  if (redisClient) {
    return (await redisClient.get(key)) || "Narrator";
  }
  return inMemory.get(key) || "Narrator";
}

export async function setRole(chatId, role) {
  const key = roleKey(chatId);
  if (redisClient) {
    await redisClient.set(key, role, { ex: 60 * 60 * 24 * 30 });
    return;
  }
  inMemory.set(key, role);
}

function pendingRoleKey(chatId) {
  return `tg:chat:${chatId}:pending_role`;
}

export async function setPendingRole(chatId, pending) {
  const key = pendingRoleKey(chatId);
  if (redisClient) {
    if (pending) {
      await redisClient.set(key, true, { ex: 60 * 5 });
    } else {
      await redisClient.del(key);
    }
    return;
  }
  if (pending) inMemory.set(key, true);
  else inMemory.delete(key);
}

export async function isPendingRole(chatId) {
  const key = pendingRoleKey(chatId);
  if (redisClient) {
    return Boolean(await redisClient.get(key));
  }
  return inMemory.has(key);
}

function modelKey(chatId) {
  return `tg:chat:${chatId}:model`;
}

export async function getModel(chatId) {
  const key = modelKey(chatId);
  if (redisClient) {
    return (await redisClient.get(key)) || "mirexa";
  }
  return inMemory.get(key) || "mirexa";
}

export async function setModel(chatId, model) {
  const key = modelKey(chatId);
  const safe = String(model || "mirexa").toLowerCase();
  if (redisClient) {
    await redisClient.set(key, safe, { ex: 60 * 60 * 24 * 30 });
    return;
  }
  inMemory.set(key, safe);
}


