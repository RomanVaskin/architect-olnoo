# Backend

**Version:** 0.5.0
**Status:** In Progress — Supabase is the primary data source for authenticated projects (architect-olnoo)
**Last Updated:** 2026-07-20

> Описывает архитектуру бэкенда: сервисы, слои приложения, паттерны и подход к обработке бизнес-логики.

---

## Назначение документа

Этот документ фиксирует технические решения по бэкенду: фреймворк, структуру сервисов, слои приложения и подходы к обработке бизнес-логики.

## Реализованный фундамент

- Next.js Route Handlers выполняют серверную валидацию и вызовы AI-провайдеров.
- Supabase SSR-клиенты разделены для браузера, Server Components, Server Actions и Route Handlers.
- Next.js Proxy обновляет cookie-сессии до рендеринга защищённых страниц.
- Платные AI-маршруты повторно проверяют пользователя на сервере и не доверяют только Proxy или состоянию интерфейса.
- При отсутствии Supabase локальная разработка доступна только в `NODE_ENV=development` через loopback-адрес; production и сетевой адрес закрываются.
- `POST /api/projects/import/prepare` проверяет manifest и создаёт проект/пути, браузер загружает бинарные файлы напрямую в приватный Storage под RLS, а `POST /api/projects/import/complete` проверяет объекты и сохраняет связанные метаданные. Большие файлы не проходят через Next.js/Vercel.
- Локальная IndexedDB-копия никогда не удаляется автоматически; синхронизация не вызывает Gemini.

## Серверный репозиторий проектов

`src/lib/server/project-repository.ts` — типизированный слой чтения/записи для авторизованных Supabase-проектов, подробно описан в `specs/server-project-repository.md`:

- Каждая функция принимает RLS-сессионный клиент (`src/lib/supabase/server.ts`) — service-role ключ нигде не используется.
- `project-row-mapping.ts` отделяет чистый маппинг строк БД → модель приложения от самих запросов, что позволяет тестировать его без Supabase-клиента.
- `project-assets.ts` подписывает пути в приватном bucket `project-assets` (короткоживущие URL, ~1 час) через RLS-политику `project_assets_select` — подпись невозможна для чужого проекта.
- Ошибки нормализуются в `ProjectRepositoryError` (`not-found | database-failed | invalid-request`) и никогда не возвращают клиенту сырое сообщение Postgres/Storage (`classifyRepositoryError`).
- Маршруты: `GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects/:id/selected-concept`, `POST /api/projects/:id/feedback`, `GET /api/projects/:id/files/:fileId/url` — все проверяют сессию через `requireAuthenticatedUser` (см. `specs/authentication.md`) и отклоняют `local-development` bypass против реального backend.
- Резолвер воркспейса (`src/lib/use-project-data.ts`) разрешает id в порядке demo → `local-*` (IndexedDB) → uuid (Supabase) и различает `not-found`, `authentication-required`, `temporary-error`, `local-unavailable`.

## Следующий подэтап

Чтение/запись серверных проектов реализованы. Осталось за рамками этой задачи: серверный пайплайн генерации/исправления концепций (сейчас работает только для локальных проектов), дашборд `/` всё ещё показывает только demo-данные.

## Будущее содержание

- Структура сервисов
- Слои приложения (controllers/services/repositories)
- Очереди и фоновые задачи
