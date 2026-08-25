# Splitka

Спрощений Splitwise: групові витрати без реєстрації. Кожна група має унікальну лінку, учасники заходять просто за ім'ям (унікальним у межах групи). Творець групи може одразу додати імена друзів і розіслати кожному особистий лінк (`/g/{id}#me=Ім'я`) — відкривши його, людина заходить під своїм ім'ям у будь-якому браузері. PWA: можна встановити на телефон, працює офлайн у режимі читання.

**Прод:** https://splitka-seven.vercel.app

## Стек

- Next.js 16 (App Router) + React 19, TypeScript
- Сховище: Upstash Redis (Vercel Marketplace) — шар ізольовано в `lib/store.ts`.
  Група = Redis-хеш, кожна витрата/учасник — окреме поле, тож конкурентні
  записи атомарні й не затирають одне одного. Старі групи зі старого сховища
  (npoint.io) імпортуються ліниво при першому читанні.
- Стилі: ванільний CSS (`app/globals.css`)
- PWA: `app/manifest.ts` + `public/sw.js` (network-first, офлайн-фолбек з кешу)

## Запуск

```bash
npm install
npm run dev
```

Сторові потрібні змінні оточення (у `.env.local` для локальної розробки):

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

На Vercel вони інжектяться автоматично після підключення Upstash for Redis
через Marketplace (Storage → Create Database → Upstash for Redis). Клієнт
також розуміє легасі-імена `KV_REST_API_URL`/`KV_REST_API_TOKEN`.

## Деплой

Кожен пуш у `main` автоматично деплоїться на Vercel через Git-інтеграцію.

## API

- `POST /api/groups` — створити групу (опційно `members: string[]` — одразу з іменами друзів)
- `GET /api/groups/:id` — отримати групу
- `POST /api/groups/:id/members` — приєднатися (ім'я унікальне, без регістру)
- `POST /api/groups/:id/expenses` — додати витрату/переказ
- `PUT/DELETE /api/groups/:id/expenses/:expenseId` — редагувати/видалити
- `GET /api/smoke` — хелсчек: створює демо-групу і звіряє баланси
