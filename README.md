# Frontend (Next.js)

## Локальний запуск
1. Спочатку підніми **бекенд**. Фронт ходить на API через проксі Next (`/backend-api/...` → бекенд).
2. Якщо бекенд не на `http://localhost:4000`, створи `.env.local` і задай `BACKEND_URL=...` (див. `.env.local.example`).
3. `npm install`
4. `npm run dev`

Відкрий **http://localhost:3000** — реєстрація, вхід, робота з файлами.

Тести: `npm test`

## Продакшн
Перед **`npm run build`** задай **`BACKEND_URL`** (де фізично Nest; Next підставляє його в rewrites при збірці). Найзручніше — **`frontend/.env.production`**, наприклад `BACKEND_URL=https://api.example.com` або `http://127.0.0.1:4000`, якщо API на тій самій машині.

```bash
npm ci
npm run build
npm run start
```

Порт за замовчуванням **3000**; інший: `PORT=8080 npm run start`.
