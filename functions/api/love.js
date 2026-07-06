export async function onRequestPost(context) {
  const { env } = context;

  if (!env.CEREBRAS_API_KEY) {
    return jsonResponse({
      error: true,
      message: "CEREBRAS_API_KEY не задан в Cloudflare Variables and Secrets."
    }, 500);
  }

  try {
    const message = await generateLoveMessage(env.CEREBRAS_API_KEY);

    return jsonResponse({
      blocked: false,
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
