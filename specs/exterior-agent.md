# Exterior Agent

**Version:** 0.2.0
**Status:** Draft
**Last Updated:** 2026-07-18

> Спецификация агента, отвечающего за анализ/генерацию экстерьера здания.

---

## Назначение документа

Описывает роль Exterior Agent в AI-пайплайне: какие данные он принимает на вход, что возвращает, и какая модель используется.

## Реализация (MVP)

Первая рабочая версия реализована как серверный Route Handler `POST /api/concepts/generate` (`src/app/api/concepts/generate/route.ts`), а не как отдельный оркестрируемый агент — оркестрация и Multi-Agent System из `02-PLATFORM-ARCHITECTURE.md` появятся позже.

### Входные данные

Multipart FormData:

- `images` — 1–3 растровых изображения (JPEG/PNG/WebP; PDF отклоняется с понятным сообщением, см. `specs/image-upload.md`);
- `goal`, `explicitChanges` — цель и явные требуемые изменения;
- `mustKeep`, `mayChange` — JSON-массивы строк (см. [Constraint Categories](../docs/01-PRODUCT.md#5-constraint-categories));
- `mode` — один из продуктовых режимов: `auto` | `fast` | `balanced` | `maximum-quality`;
- `variantCount` — 1–3.

Всё валидируется повторно на сервере (`src/lib/ai/request-validation.ts`), независимо от клиентской валидации в мастере.

### Используемая модель

Провайдер-независимый реестр (`src/lib/ai/model-registry.ts`) сопоставляет продуктовый режим с провайдером и моделью — эта информация не покидает сервер:

| Режим | Провайдер | Модель |
|---|---|---|
| Auto | Gemini | сейчас совпадает с Balanced |
| Fast | Gemini | `gemini-3.1-flash-lite-image` |
| Balanced | Gemini | `gemini-3.1-flash-image` (`GEMINI_IMAGE_MODEL`) |
| Maximum Quality | Gemini | `gemini-3-pro-image` |

Адаптер провайдера — `src/lib/ai/gemini-provider.ts` (`@google/genai`). Добавление OpenAI или FLUX означает добавление ещё одного адаптера и записи в реестре, без изменений в API-контракте, мастере или Concepts UI.

### Промпт

`src/lib/ai/prompt-builder.ts` собирает структурированный промпт с явным разделением: цель пользователя → явные изменения → изменяемые элементы → неизменяемые элементы, и инструктирует модель редактировать переданный дом (не придумывать другое здание), сохранять ракурс, композицию, этажность, объёмы, форму крыши и расположение проёмов, кроме явно разрешённого.

### Выходные данные

Нормализованный ответ на каждый вариант (без сырого ответа провайдера):

```json
{
  "status": "succeeded" | "failed",
  "mode": "balanced",
  "mimeType": "image/png",
  "imageBase64": "...",
  "warnings": [],
  "geometryVerificationNote": "Автоматическая проверка геометрии не выполнена",
  "error": { "code": "...", "message": "..." }
}
```

Интерфейс никогда не утверждает, что геометрические ограничения проверены — генерация и проверка геометрии остаются разными процессами (см. [Human Control](../docs/01-PRODUCT.md#human-control)).

### Обработка ошибок

`src/lib/ai/errors.ts` определяет коды с понятными русскоязычными сообщениями: `missing-api-key`, `unsupported-file`, `provider-timeout`, `safety-rejection`, `rate-limit`, `malformed-response`, `provider-failure`, `validation`. Конкурентность вызовов провайдера ограничена процессом (`src/lib/ai/concurrency.ts`).

### Известные ограничения

- Аутентификации и серверного rate limiting на уровне пользователя пока нет — см. `docs/09-TODO.md`.
- Геометрическая проверка результата (Code Compliance / Reviewer Agent) не реализована.
