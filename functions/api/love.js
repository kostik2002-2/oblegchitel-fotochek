const LIMIT = 10;
const WINDOW_SECONDS = 60 * 60;
const BLOCK_MESSAGE = "Любовь моя, отдохни часок, дай мне собраться с мыслями, мы обязательно продолжим!";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.CEREBRAS_API_KEY) {
    return jsonResponse({
      error: true,
      message: "CEREBRAS_API_KEY не задан в Cloudflare Variables and Secrets."
    }, 500);
  }

  if (!env.LOVE_LIMITS) {
    return jsonResponse({
      error: true,
      message: "KV binding LOVE_LIMITS не подключён."
    }, 500);
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `love:${clientIp}`;
  const now = Math.floor(Date.now() / 1000);

  const current = await readLimitState(env.LOVE_LIMITS, key, now);

  if (current.blockedUntil && now < current.blockedUntil) {
    return jsonResponse({
      blocked: true,
      retryAfter: current.blockedUntil - now,
      message: BLOCK_MESSAGE
    }, 429);
  }

  if (current.count >= LIMIT) {
    const blockedUntil = now + WINDOW_SECONDS;

    await env.LOVE_LIMITS.put(
      key,
      JSON.stringify({
        count: LIMIT,
        windowStartedAt: current.windowStartedAt,
        blockedUntil
      }),
      { expirationTtl: WINDOW_SECONDS + 120 }
    );

    return jsonResponse({
      blocked: true,
      retryAfter: WINDOW_SECONDS,
      message: BLOCK_MESSAGE
    }, 429);
  }

  try {
    const message = await generateLoveMessage(env.CEREBRAS_API_KEY);

    await env.LOVE_LIMITS.put(
      key,
      JSON.stringify({
        count: current.count + 1,
        windowStartedAt: current.windowStartedAt || now,
        blockedUntil: 0
      }),
      { expirationTtl: WINDOW_SECONDS + 120 }
    );

    return jsonResponse({
      blocked: false,
      remaining: Math.max(0, LIMIT - current.count - 1),
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

async function readLimitState(kv, key, now) {
  const fallback = {
    count: 0,
    windowStartedAt: now,
    blockedUntil: 0
  };

  const raw = await kv.get(key);

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    const blockedUntil = Number(parsed.blockedUntil || 0);

    if (blockedUntil && now < blockedUntil) {
      return {
        count: Number(parsed.count || 0),
        windowStartedAt: Number(parsed.windowStartedAt || now),
        blockedUntil
      };
    }

    const windowStartedAt = Number(parsed.windowStartedAt || 0);

    if (!windowStartedAt || now - windowStartedAt >= WINDOW_SECONDS) {
      return fallback;
    }

    return {
      count: Number(parsed.count || 0),
      windowStartedAt,
      blockedUntil: 0
    };
  } catch {
    return fallback;
  }
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

  if (!content) {
    throw new Error("Cerebras returned empty content");
  }

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
