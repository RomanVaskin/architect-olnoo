# Supabase

Миграции в этой папке — версионируемая схема backend Architect OLNOO, применённая к проекту **architect-olnoo** (ref `iaomlfkcbjeqpgnbpwxs`).

- `migrations/202607200001_backend_foundation.sql` — основная схема (workspaces/projects/concepts/..., RLS, приватный Storage bucket `project-assets`) плюс очистка несвязанной legacy-схемы, которая уже существовала в этом Supabase-проекте до применения. Ключи идемпотентности используются для двухэтапного server import.
- `migrations/202607200002_fix_workspace_select_visibility.sql` — исправление RLS-политики `workspaces_select`, найденное при верификации: без него первое `insert(...).select()` в `workspaces` (первое сохранение в облако для любого нового пользователя) падало из-за требования Postgres проходить SELECT-политику при `RETURNING`.

`backups/pre-cleanup-architect-olnoo-20260720.sql` — схема-бэкап legacy-объектов, снятых перед применением 202607200001 (все были пусты — 0 строк, без внешних потребителей).

Новые миграции по-прежнему нужно ревьюить перед `supabase db push --linked`; `supabase/.temp/` (локальное состояние CLI, включая pooler-строку с паролем) в git не попадает.
