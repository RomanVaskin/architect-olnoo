# Server Project Repository

**Version:** 0.3.0
**Status:** Implemented — automated tests only, no live authenticated verification
**Last Updated:** 2026-07-22

> Читает и пишет авторизованные проекты через Supabase как основной источник данных, делает приватные изображения доступными через короткоживущие подписанные URL, разрешает id проекта в правильный источник данных и сохраняет выбор концепции/отзыв на сервере для облачных проектов.

---

## Назначение документа

Спецификация серверного слоя, добавленного поверх уже применённой схемы (`docs/03-DATABASE.md`) и уже реализованного одностороннего переноса (`specs/server-project-sync.md`): чтение проектов, приватные изображения, резолвер `/projects/:id` и запись выбранной концепции/отзыва.

## Репозиторий (`src/lib/server/`)

- `project-row-mapping.ts` — чистый маппинг строк Postgres (snake_case, по `supabase/migrations/202607200001_backend_foundation.sql`) в модель приложения (`src/lib/types.ts`). Не зависит от Supabase-клиента, поэтому проверяется точечными тестами без сети.
- `project-assets.ts` — подписывает пути приватного bucket `project-assets` (`signPath`/`signPaths`, TTL по умолчанию 1 час). Подпись выполняется RLS-сессией пользователя, поэтому политика `project_assets_select` действует и здесь: подписать чужой путь невозможно. Любая ошибка возвращает `null`, а не исключение — отсутствующее или временно недоступное изображение деградирует к существующей заглушке в интерфейсе, а не ломает страницу.
- `project-repository.ts` — оркестрация: `listServerProjects`, `getServerProjectDetail`, `setSelectedConcept`, `addConceptFeedback`, `getSignedFileUrl`. Ошибки нормализуются в `ProjectRepositoryError` (`not-found | database-failed | invalid-request`) и никогда не содержат сырое сообщение Postgres/Storage; `classifyRepositoryError` — чистая функция, отображающая это в HTTP-ответ, вынесена отдельно от `next/server`, чтобы быть проверяемой юнит-тестами.
- Ни одна функция не использует service-role ключ — только клиент из `src/lib/supabase/server.ts`, привязанный к cookie-сессии текущего пользователя.

## Приватные изображения

Клиент никогда не получает `storage_path`. Ответ детали проекта содержит подписанный `url` на файл плюс непрозрачный `project_files.id`; `GET /api/projects/:id/files/:fileId/url` перевыпускает URL, когда исходный истёк. `src/lib/use-refreshable-image-src.ts` перехватывает `<img onerror>` в `ConceptVisual` и `FileList` и подставляет свежий URL один раз, не зацикливаясь. Источники: исходные фото/чертежи/документы и изображения концепций (оба — строки `project_files`, различаются `kind`).

Обрезанные Source Views (`CroppedImagePreview`) остаются Blob-based: для локальных проектов используется IndexedDB blob как раньше; для серверных `src/lib/use-fetched-blob.ts` один раз скачивает подписанный URL в Blob (сам подписанный URL — это и есть credential, дополнительная аутентификация не нужна).

## Резолвер `/projects/:id` (`src/lib/use-project-data.ts`)

Порядок разрешения id:

1. Явный demo id (`DEMO_PROJECT_IDS` в `src/lib/mock-data.ts`) → статичные mock-данные.
2. `local-*` → IndexedDB (`getLocalProject`).
3. Иначе (UUID) → `GET /api/projects/:id`.

Отличает четыре состояния вместо одного «не найдено»:

- `not-found` — проекта с таким id нет либо он принадлежит другому пользователю (RLS делает эти два случая неотличимыми на уровне БД специально — иначе ответ раскрывал бы факт существования чужого проекта).
- `authentication-required` — нет подтверждённой сессии.
- `temporary-error` — сеть/5xx/backend не настроен; никогда не показывается как «не найдено».
- `local-unavailable` — id начинается с `local-`, но такой записи нет в IndexedDB этого браузера (другое устройство/браузер либо очищенные данные).

## Список `/projects` (`src/lib/use-project-list.ts`, `src/lib/project-list-merge.ts`)

Объединяет три источника: `GET /api/projects` (облако), `listLocalProjects()` (IndexedDB) и demo-проекты. Локальный проект, для которого сохранена запись синхронизации со статусом `synced` (`getLocalProjectSync`), исключается из локального раздела — он уже показан как облачная карточка (см. `specs/server-project-sync.md`). Demo-проекты показываются отдельным, явно подписанным разделом и никогда не смешиваются с реальными карточками. Если у пользователя нет ни облачных, ни локальных проектов, показывается честный empty state, а не подмена демо-данными.

### Превью проекта в карточке (`src/lib/project-cover.ts`)

Единое правило «какое изображение представляет проект», общее для списка `/projects`, карточек дашборда (`dashboard-merge.ts`) и обзорной страницы проекта: побеждает изображение самой недавно созданной концепции, у которой оно есть; иначе — фото из подтверждённого Primary Source View (любого `kind`, не только `photo` — ничто не требует, чтобы основной вид был именно фотографией); иначе превью нет, и карточка показывает декоративную заглушку вместо сломанной картинки.

- Для облачных проектов список получает уже подписанный `coverImage` от `listServerProjects` — та же приоритетность применяется на уровне сырых `storage_path` (`resolveCoverPaths`), без выгрузки и подписи всех файлов всех проектов, только ради эффективности батча.
- Для локальных (IndexedDB) проектов `coverImage` никогда не хранится как готовая строка: `resolveProjectCover` выбирает нужный Blob из уже гидратированного `Project`, а `ProjectThumbnail` превращает его в object URL через `useBlobUrl` (с корректным revoke при размонтировании) — ровно так же, как `ConceptVisual` уже делает для изображений концепций. Раньше `coverImage` локального проекта был равен его `id` (техническая заглушка), из-за чего `<img src>` пытался загрузить несуществующий адрес вместо реального превью или декоративной заглушки.
- Demo-проекты (`src/lib/mock-data.ts`) хранят `coverImage: ""` — они никогда не были реальными фотографиями, и пустая строка корректно приводит к декоративной заглушке.

## Выбор концепции и отзыв

Для облачных проектов (`isServerProjectId`) `src/lib/use-project-concept-review.ts` пишет через `POST /api/projects/:id/selected-concept` и `POST /api/projects/:id/feedback` вместо localStorage; для локальных/demo проектов поведение не изменилось (`src/lib/use-concept-review.ts`, localStorage). Выбор концепции — оптимистичный, откатывается при ошибке сервера; `author_name`/`author_user_id` отзыва берутся из сессии, а не от клиента.

## Создание новой концепции для облачных проектов

Первичная генерация и исправление по Quality Gate для облачных проектов реализованы отдельной спецификацией — см. `specs/cloud-generation-pipeline.md`. Кнопка «Создать исправленную версию» в `src/components/workspace/concepts-workspace.tsx` доступна и для локальных, и для облачных проектов; логика их персистентности не унифицирована (IndexedDB для локальных, Supabase Storage/Postgres для облачных) — каждая ветка использует свой собственный, независимо протестированный путь.

## Проверка

Точечные тесты на `node:test` без сети: `project-row-mapping.test.ts`, `project-repository.test.ts` (через минимальный fake Supabase query builder, включая `listServerProjects`/приоритет превью), `project-cover.test.ts` (общее правило превью), `project-assets.test.ts`, `project-route-helpers.test.ts` (классификация ошибок), `project-id.test.ts`, `project-list-merge.test.ts`. Живая проверка через реальный Supabase-вход не выполнялась: регистрация тестового аккаунта требует подтверждения по email, к которому нет доступа в этой среде, а менять конфигурацию Auth ради обхода запрещено условиями задачи.
