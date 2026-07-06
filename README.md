# Облегчитель фоточек для Аси — Cloudflare Pages + Cerebras

Эта версия совместима с Cloudflare Pages без `wrangler.toml`.

## Что внутри

- `public/` — сайт и конвертер фото в браузере.
- `functions/api/love.js` — Cloudflare Pages Function, которая вызывает Cerebras API.
- `package.json` — служебный файл.

## Важно

`wrangler.toml` больше не нужен и должен быть удалён из GitHub.

## Лимит

Сейчас лимит 10 признаний в час сделан на стороне браузера через `localStorage`:

- 10 признаний;
- на 11-е появляется:
  «Любовь моя, отдохни часок, дай мне собраться с мыслями, мы обязательно продолжим!»;
- кнопка блокируется;
- вместо сердечка появляется таймер.

Ключ Cerebras при этом не попадает в браузер. Он хранится только в Cloudflare Secret.

## Что нужно настроить в Cloudflare

Pages project → Settings → Variables and secrets → Add:

```txt
CEREBRAS_API_KEY
```

Значение — твой ключ Cerebras. Нужно сохранить как Secret / Encrypted.
