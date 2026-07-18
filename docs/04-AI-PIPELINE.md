# AI Pipeline

**Version:** 0.2.0
**Status:** Draft
**Last Updated:** 2026-07-18

> Описывает архитектуру AI-конвейера: агентов, их роли, порядок обработки и модели, используемые в проекте.

---

## Назначение документа

Этот документ фиксирует, как устроен AI pipeline проекта — от приёма входных данных (например, изображений) до генерации результата через цепочку агентов.

## Первая реализация: генерация изображений экстерьера

Первый работающий кусок пайплайна — синхронный Route Handler `POST /api/concepts/generate` (не полноценный Agent Orchestrator из [02-PLATFORM-ARCHITECTURE.md](02-PLATFORM-ARCHITECTURE.md), который появится позже). Подробности контракта, модели и обработки ошибок — в [specs/exterior-agent.md](../specs/exterior-agent.md).

Ключевой архитектурный выбор: провайдер и конкретная модель полностью скрыты за провайдер-независимым реестром режимов (`src/lib/ai/model-registry.ts`) и адаптером (`src/lib/ai/gemini-provider.ts`) — ни клиент, ни остальной сервер не знают технических имён моделей, в соответствии с [AI Abstraction](01-PRODUCT.md#ai-abstraction) и [No Vendor Lock-In](01-PRODUCT.md#no-vendor-lock-in). Добавление другого провайдера (OpenAI, FLUX) не требует изменений в API-контракте или UI.

## Содержание (TBD)

- Общая схема пайплайна для остальных модулей (интерьер, ландшафт, BIM и т.д.)
- Список агентов и их ответственность (см. [AI Agents](01-PRODUCT.md#ai-agents))
- Полноценный Agent Orchestrator и AI Orchestrator (см. [AI Layer](02-PLATFORM-ARCHITECTURE.md#ai-layer))
- Ретраи на уровне оркестрации (сейчас есть только таймаут и явные коды ошибок на уровне одного запроса, см. `src/lib/ai/errors.ts`)

## Связанные документы

- [specs/vision-agent.md](../specs/vision-agent.md)
- [specs/exterior-agent.md](../specs/exterior-agent.md)
- [specs/reviewer-agent.md](../specs/reviewer-agent.md)
