# LoveDrop — Cloudflare Pages + Cerebras

LoveDrop — маленький сервис для быстрой подготовки изображений к web.

Основная функция:

- загрузка изображения;
- уменьшение, если меньшая сторона больше 2000 px;
- конвертация в облегчённый JPG;
- скачивание результата.

Милый сюрприз:

- кнопка-сердечко генерирует короткое признание через Cerebras;
- API-ключ хранится только в Cloudflare Secret;
- клиентский лимит 10 признаний в час.

## SEO и файлы

Добавлены:

- базовые meta-теги;
- Open Graph;
- Twitter Card;
- `favicon.svg`;
- `apple-touch-icon.svg`;
- `site.webmanifest`;
- `robots.txt`;
- `sitemap.xml`;
- `og-image.svg`.

Основной домен для SEO:

```txt
https://love.cinemaprompt.ru/
```

## Cloudflare Secret

В Cloudflare Pages должен быть задан Secret:

```txt
CEREBRAS_API_KEY
```
