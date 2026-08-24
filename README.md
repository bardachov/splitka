# Splitka

Спрощений Splitwise: групові витрати без реєстрації. Кожна група має унікальну лінку, учасники заходять просто за ім'ям (унікальним у межах групи). PWA: можна встановити на телефон, працює офлайн у режимі читання.

**Прод:** https://splitka-seven.vercel.app

## Стек

- Next.js 16 (App Router) + React 19, TypeScript
- Сховище: npoint.io (безкоштовний keyless JSON-стор) — шар ізольовано в `lib/store.ts`, легко замінити на KV/Postgres
- Стилі: ванільний CSS (`app/globals.css`)
- PWA: `app/manifest.ts` + `public/sw.js` (network-first, офлайн-фолбек з кешу)

## Запуск

```bash
npm install
npm run dev
```

## Деплой

Кожен пуш у `main` автоматично деплоїться на Vercel через Git-інтеграцію.

## API

- `POST /api/groups` — створити групу
- `GET /api/groups/:id` — отримати групу
- `POST /api/groups/:id/members` — приєднатися (ім'я унікальне, без регістру)
- `POST /api/groups/:id/expenses` — додати витрату/переказ
- `PUT/DELETE /api/groups/:id/expenses/:expenseId` — редагувати/видалити
- `GET /api/smoke` — хелсчек: створює демо-групу і звіряє баланси
