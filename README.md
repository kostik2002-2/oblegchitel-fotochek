# Облегчитель фоточек для Аси — Cloudflare + Cerebras

## Структура

- `public/` — сайт, дизайн, конвертер фото в браузере.
- `functions/api/love.js` — Cloudflare Pages Function для признаний через Cerebras.
- `wrangler.toml` — заготовка для Cloudflare Pages.
- `package.json` — команды для локального запуска и деплоя.

## Настройка Cloudflare

### 1. Создать Pages проект

Cloudflare Dashboard → Workers & Pages → Create → Pages.

Build command: оставить пустым.

Build output directory:

```txt
public
```

### 2. Создать KV namespace

Cloudflare Dashboard → Workers & Pages → KV → Create namespace.

Название:

```txt
asya_love_limits
```

### 3. Подключить KV к Pages

Pages проект → Settings → Bindings → Add → KV namespace.

Variable name:

```txt
LOVE_LIMITS
```

KV namespace:

```txt
asya_love_limits
```

После этого сделать redeploy.

### 4. Добавить ключ Cerebras

Pages проект → Settings → Variables and Secrets → Add.

Variable name:

```txt
CEREBRAS_API_KEY
```

Value:

```txt
твой_ключ_Cerebras
```

Включить Encrypt / Secret.

### 5. Проверить API

Открыть:

```txt
https://твой-проект.pages.dev/api/love
```

Должно ответить:

```txt
Love API работает. Используй POST /api/love.
```

## Лимит

- 10 признаний в час на IP;
- на 11 запрос:
  «Любовь моя, отдохни часок, дай мне собраться с мыслями, мы обязательно продолжим!»;
- кнопка блокируется;
- вместо сердечка появляется таймер.

## Важно

`CEREBRAS_API_KEY` нельзя вставлять в `script.js`, `index.html` или `wrangler.toml`.
Ключ должен быть только в Cloudflare Secret.
