const LIMIT = 10;
const WINDOW_SECONDS = 60 * 60;
const BLOCK_MESSAGE = "Любовь моя, отдохни часок, дай мне собраться с мыслями, мы обязательно продолжим!";

export class LoveLimiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const now = Math.floor(Date.now() / 1000);
    const stored = await this.state.storage.get("limit");
    const current = normalizeState(stored, now);

    if (current.blockedUntil && now < current.blockedUntil) {
      return jsonResponse({
        allowed: false,
        retryAfter: current.blockedUntil - now
      });
    }

    if (current.count >= LIMIT) {
      const blockedUntil = now + WINDOW_SECONDS;

      await this.state.storage.put("limit", {
        count: LIMIT,
        windowStartedAt: current.windowStartedAt,
        blockedUntil
      });

      return jsonResponse({
        allowed: false,
        retryAfter: WINDOW_SECONDS
      });
    }

    await this.state.storage.put("limit", {
      count: current.count + 1,
      windowStartedAt: current.windowStartedAt || now,
      blockedUntil: 0
    });

    return jsonResponse({
      allowed: true,
      remaining: Math.max(0, LIMIT - current.count - 1)
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.CEREBRAS_API_KEY) {
    return jsonResponse({
      error: true,
      message: "CEREBRAS_API_KEY не задан в Cloudflare Variables and Secrets."
    }, 500);
  }

  if (!env.LOVE_LIMITER) {
    return jsonResponse({
      error: true,
      message: "Durable Object binding LOVE_LIMITER не подключён."
    }, 500);
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const limiterId = env.LOVE_LIMITER.idFromName(clientIp);
  const limiter = env.LOVE_LIMITER.get(limiterId);

  const limitResponse = await limiter.fetch("https://love-limiter.local/check", {
    method: "POST"
  });

  const limit = await limitResponse.json();

  if (!limit.allowed) {
    return jsonResponse({
      blocked: true,
      retryAfter: Number(limit.retryAfter || WINDOW_SECONDS),
      message: BLOCK_MESSAGE
    }, 429);
  }

  try {
    const message = await generateLoveMessage(env.CEREBRAS_API_KEY);

    return jsonResponse({
      blocked: false,
      remaining: Number(limit.remaining || 0),
      message
    });
  } catch (error) {
    return jsonResponse({
      error: true,
      message: "Любовь моя, я немного растерялся. Попробуй ещё раз через минутку.",
      details: String(error && error.message ? error.message : error)
    }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({
    ok: true,
    message: "Love API работает. Используй POST /api/love."
  });
}

function normalizeState(stored, now) {
  const fallback = { count: 0, windowStartedAt: now, blockedUntil: 0 };

  if (!stored || typeof stored !== "object") return fallback;

  const blockedUntil = Number(stored.blockedUntil || 0);

  if (blockedUntil && now < blockedUntil) {
    return {
      count: Number(stored.count || 0),
      windowStartedAt: Number(stored.windowStartedAt || now),
      blockedUntil
    };
  }

  const windowStartedAt = Number(stored.windowStartedAt || 0);

  if (!windowStartedAt || now - windowStartedAt >= WINDOW_SECONDS) return fallback;

  return {
    count: Number(stored.count || 0),
    windowStartedAt,
    blockedUntil: 0
  };
}

async function generateLoveMessage(apiKey) {
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: "Ты пишешь короткие романтичные признания в любви на русском языке от первого лица. Пиши как живой влюблённый парень. 1–2 предложения. Тепло, нежно, искренне, немного игриво. Без стихов, без списков, без эмодзи, без кавычек. Не упоминай ИИ, модель, API или бота. Иногда можно обращаться: малышка, любовь моя, солнышко, но не злоупотребляй."
        },
        {
          role: "user",
          content: "Напиши новое короткое признание в любви для Аси."
        }
      ],
      max_completion_tokens: 90,
      temperature: 0.9
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cerebras error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) throw new Error("Cerebras returned empty content");

  return content.replace(/^["«]+|["»]+$/g, "").trim();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
