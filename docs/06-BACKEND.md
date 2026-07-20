# Backend

**Version:** 0.6.0
**Status:** In Progress — Supabase is the primary data source for authenticated projects (architect-olnoo); cloud generation/correction implemented
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

## Серверный пайплайн генерации и исправления концепций

`specs/cloud-generation-pipeline.md` описывает `POST /api/projects/:id/concepts/generate` и `POST /api/projects/:id/concepts/:conceptId/correct`: сервер сам загружает подтверждённый Primary View/опорные ракурсы проекта из приватного Storage под RLS-сессией пользователя (клиент передаёт только `attemptKey`/`mode`/`autoReview`, без изображений), обрезает их через `sharp` (`src/lib/server/image-crop.ts`, `src/lib/server/cloud-generation-source.ts`) и переиспользует существующий provider/model-registry/Reviewer через отдельный оркестратор (`src/lib/server/cloud-generation-runner.ts`), не трогая уже проверенные локальные маршруты. `src/lib/server/generation-attempt-repository.ts` реализует восстанавливаемое состояние платной попытки (`pre-dispatch → dispatched → provider-completed → completed`, плюс `failed`/`persistence-partial`) поверх уже применённой таблицы `generation_attempts` — миграция не потребовалась.

## Реальный Dashboard

`/` (`src/app/page.tsx`) больше не показывает demo-данные авторизованным пользователям. `src/lib/server/dashboard-repository.ts` агрегирует облачные концепции/проекты, ожидающие решения, и последнюю активность через RLS-сессию (`GET /api/dashboard`); `src/lib/dashboard-merge.ts` — чистая функция, объединяющая это с локальными несинхронизированными проектами из IndexedDB. Временная ошибка бэкенда показывается отдельным баннером и не превращается в пустой аккаунт; demo-проекты показываются только в честном пустом состоянии и явно подписаны «Демо».

## Следующий подэтап

Осталось за рамками этой задачи: распределённый rate limiting и учёт стоимости AI-вызовов на пользователя; облачная генерация ограничена одним вариантом за попытку (`variantCount = 1`), в отличие от 1–3 у локального пайплайна.

## Будущее содержание

- Структура сервисов
- Слои приложения (controllers/services/repositories)
- Очереди и фоновые задачи
