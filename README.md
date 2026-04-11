# Frontend (Next.js)

## Локальний запуск

1. Спочатку підніми **бекенд** (порт **4000**), інакше запити до API не працюватимуть.
2. Скопіюй змінні: `cp .env.local.example .env.local` (там уже `NEXT_PUBLIC_API_URL=http://localhost:4000`).
3. `npm install`
4. `npm run dev`

Відкрий **http://localhost:3000** — реєстрація, вхід, робота з файлами.

Тести: `npm test`
