# Authentication

**Version:** 0.2.0
**Status:** Implemented and verified against architect-olnoo
**Last Updated:** 2026-07-20

> Описывает вход пользователей и защиту платных AI-маршрутов до подключения серверного хранения проектов.

---

## Реализация

- Supabase Auth подключён через `@supabase/ssr` и `@supabase/supabase-js`.
- Браузерный и серверный клиенты разделены в `src/lib/supabase/`.
- Next.js Proxy обновляет cookie-сессию и проверяет JWT через `supabase.auth.getClaims()`; сервер не использует `getSession()` для принятия решений об авторизации.
- `/login` поддерживает вход по email/паролю, создание аккаунта и подтверждение email через `/auth/callback`.
- `POST /api/concepts/generate` и `POST /api/concepts/correct` самостоятельно проверяют авторизацию и возвращают JSON `401`, не полагаясь только на клиентский интерфейс или Proxy.
- Service Role key не используется и не должен появляться в `NEXT_PUBLIC_*` переменных.

## Режимы запуска

- Если Supabase настроен, все страницы приложения требуют подтверждённую сессию.
- Если Supabase не настроен в `next dev`, development bypass действует только для loopback-адресов (`localhost`/`127.0.0.1`), чтобы не открывать платный маршрут другим устройствам локальной сети.
- Если Supabase не настроен в production, страницы перенаправляются на экран конфигурации, а платные AI-маршруты закрываются с `503`. Production никогда не получает development bypass.

## Переменные окружения

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

После добавления значений приложение требуется перезапустить. Publishable key предназначен для клиента и защищается RLS; секретный Service Role key в браузер не передаётся.

## Следующий шаг

Миграция `supabase/migrations/202607200001_backend_foundation.sql` применена к `architect-olnoo`. Signup/signin проверены выделенными тестовыми аккаунтами; IndexedDB остаётся резервным локальным хранилищем.
