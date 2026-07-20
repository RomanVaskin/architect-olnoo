# TODO

**Version:** 0.3.0
**Status:** Draft
**Last Updated:** 2026-07-20

> Список текущих задач и открытых вопросов по проекту Architect OLNOO.

---

## Назначение документа

Этот документ служит рабочим списком задач: что нужно сделать, что уточнить, и что заблокировано.

## Открытые задачи

- [ ] Наполнить содержанием документы в `docs/`
- [ ] Наполнить содержанием документы в `specs/`
- [x] Подключить фундамент Supabase Auth и защитить `POST /api/concepts/generate` / `POST /api/concepts/correct` проверенной серверной сессией
- [x] Добавить `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` выбранного проекта (`architect-olnoo`) в `.env.local`; Site URL в Supabase уже соответствовал `http://localhost:3000`
- [x] Рассмотреть и применить `supabase/migrations/202607200001_backend_foundation.sql` к проекту `architect-olnoo` (ref `iaomlfkcbjeqpgnbpwxs`) после очистки несвязанной legacy-схемы, обнаруженной в этом же проекте
- [x] Реализовать идемпотентный импорт локального проекта, файлов, ракурсов, концепций, версий, feedback и activity в PostgreSQL/Storage без удаления IndexedDB-копии и без AI-запросов
- [x] Проверить импорт на синтетическом тестовом проекте: auth, анонимный доступ, изоляция между пользователями, prepare/upload/complete, повтор без дублей, локальная копия не изменена
- [ ] Добавить чтение серверных проектов как основной источник данных вместо IndexedDB
- [ ] Добавить распределённый серверный rate limiting и учёт стоимости AI-вызовов — текущая проверка сессии и process-wide concurrency cap не заменяют rate limiting
- [ ] Заменить временное MVP-хранилище проектов в IndexedDB (`src/lib/mvp-local-project-store.ts`) на реальный бэкенд, когда он появится
- [ ] Перейти на Gemini Files API вместо inline base64 для изображений, когда запросы начнут регулярно приближаться к консервативному лимиту суммарного размера (`MAX_TOTAL_INLINE_IMAGE_BYTES` в `src/lib/ai/request-validation.ts`) — сейчас не реализовано, так как размеры запросов MVP далеки от лимита

## Открытые вопросы

- (пусто)
