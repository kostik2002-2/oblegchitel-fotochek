export async function onRequestPost(context) {
  const { env } = context;

  if (!env.CEREBRAS_API_KEY) {
    return jsonResponse({
      error: true,
      message: "CEREBRAS_API_KEY не задан в Cloudflare Variables and Secrets."
    }, 500);
  }

  try {
    const message = await generateLoveMessage(env.CEREBRAS_API_KEY, env.CEREBRAS_MODEL);

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

async function generateLoveMessage(apiKey, modelFromEnv) {
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelFromEnv || "gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: "Ты пишешь короткие романтичные признания в любви на русском языке от первого лица. Пиши как живой влюблённый парень. 1–2 предложения. Тепло, нежно, искренне, немного игриво. Без стихов, без списков, без эмодзи, без кавычек. Не упоминай ИИ, модель, API или бота. Каждое признание должно начинаться строго с обращения «Ася,». Никогда не используй формы «Аси», «Асе», «Асю», «Асенька» или любые другие варианты имени в начале текста. Иногда можно обращаться: малышка, любовь моя, солнышко, но только после обращения «Ася,» и не злоупотребляй. Старайся, чтобы каждое признание было уникальным и не повторяло предыдущие по смыслу и началу."
        },
        {
          role: "user",
          content: "Напиши новое короткое признание в любви для Аси."
        }
      ],
      max_completion_tokens: 350,
      temperature: 0.9
    })
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Cerebras error ${response.status}: ${rawText}`);
  }

  let data;

  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Cerebras returned non-JSON response: ${rawText}`);
  }

  const message = data?.choices?.[0]?.message;
  const content = extractTextContent(message?.content);

  if (!content) {
    throw new Error(`Cerebras returned empty content. Raw response: ${JSON.stringify(data)}`);
  }

  return content.replace(/^["«]+|["»]+$/g, "").trim();
}

function extractTextContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
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
