import type { Project } from "./types";

/**
 * Realistic mock data standing in for the backend while it is not yet
 * available (see docs/01-PRODUCT.md — Single Source of Truth). Shaped after
 * the MVP golden path: upload an existing house, describe changes, review
 * generated concepts.
 */
export const projects: Project[] = [
  {
    id: "dom-na-valdae",
    name: "Дом на Валдае",
    buildingType: "Частный дом",
    coverImage: "valdai",
    lifecycleStage: "concept",
    state: "awaiting-review",
    updatedAt: "2026-07-17T14:20:00+03:00",
    site: {
      address: "Новгородская область, Валдайский район",
      climateZone: "Умеренно-континентальный, холодные зимы",
      areaSqm: 1400,
    },
    brief: {
      goal:
        "Обновить фасад существующего дома в скандинавском стиле, не увеличивая площадь и не меняя расположение окон первого этажа.",
      mustKeep: ["Геометрия и пропорции дома", "Расположение окон первого этажа", "Высота конька крыши"],
      mayChange: ["Материал и цвет фасада", "Форма и материал крыльца", "Освещение фасада"],
      wantsChanged: ["Облицовка фасада", "Цветовое решение", "Форма кровельного свеса"],
      budgetNote: "Ориентир — не выходить за рамки текущего бюджета на отделку.",
    },
    sourceFiles: [
      { id: "sf-1", name: "Фасад — вид спереди.jpg", kind: "photo", uploadedAt: "2026-07-10T10:00:00+03:00" },
      { id: "sf-2", name: "Фасад — вид сбоку.jpg", kind: "photo", uploadedAt: "2026-07-10T10:02:00+03:00" },
      { id: "sf-3", name: "Поэтажный план (скан).pdf", kind: "drawing", uploadedAt: "2026-07-10T10:05:00+03:00" },
    ],
    concepts: [
      {
        id: "concept-1",
        label: "Концепция A — светлый фасад",
        createdAt: "2026-07-16T09:00:00+03:00",
        state: "awaiting-review",
        summary: "Светлая штукатурка, тёмные оконные рамы, сохранена исходная геометрия дома.",
        changeExplanation:
          "Изменена только облицовка и цвет фасада согласно брифу; геометрия, пропорции и расположение окон первого этажа сохранены без изменений.",
      },
      {
        id: "concept-2",
        label: "Концепция B — деревянные панели",
        createdAt: "2026-07-16T09:04:00+03:00",
        state: "awaiting-review",
        summary: "Комбинация светлой штукатурки и вертикальных деревянных панелей у входа.",
        changeExplanation:
          "Добавлены деревянные панели в зоне входа для акцента; несущие элементы и оконные проёмы не затронуты.",
      },
      {
        id: "concept-3",
        label: "Концепция C — контрастный цоколь",
        createdAt: "2026-07-16T09:07:00+03:00",
        state: "draft",
        summary: "Тёмный цоколь, светлые стены, обновлённая форма крыльца.",
        changeExplanation:
          "Форма крыльца изменена согласно разделу брифа «может быть изменено»; геометрия дома сохранена.",
      },
    ],
    selectedConceptId: null,
    versions: [
      {
        id: "v-1",
        conceptId: "concept-1",
        label: "Версия 1",
        createdAt: "2026-07-16T09:00:00+03:00",
        changeSummary: "Первая генерация на основе брифа и исходных фотографий.",
      },
    ],
    feedback: [],
    activity: [
      { id: "a-1", actor: "AI Architect", actorType: "agent", action: "Сгенерированы 3 концепции фасада", createdAt: "2026-07-16T09:07:00+03:00" },
      { id: "a-2", actor: "Роман", actorType: "user", action: "Загружены исходные фотографии дома", createdAt: "2026-07-10T10:05:00+03:00" },
      { id: "a-3", actor: "Роман", actorType: "user", action: "Проект создан", createdAt: "2026-07-10T09:55:00+03:00" },
    ],
  },
  {
    id: "usadba-zvenigorod",
    name: "Усадьба в Звенигороде",
    buildingType: "Загородный дом",
    coverImage: "zvenigorod",
    lifecycleStage: "design-development",
    state: "in-progress",
    updatedAt: "2026-07-15T11:40:00+03:00",
    site: {
      address: "Московская область, г. Звенигород",
      climateZone: "Умеренный, снежные зимы",
      areaSqm: 2600,
    },
    brief: {
      goal: "Добавить второй этаж и террасу, сохранив исторический облик первого этажа.",
      mustKeep: ["Фасад первого этажа", "Материал наружных стен", "Расположение главного входа"],
      mayChange: ["Кровля", "Планировка второго этажа"],
      wantsChanged: ["Добавить второй этаж", "Добавить террасу со стороны сада"],
    },
    sourceFiles: [
      { id: "sf-4", name: "Дом — общий вид.jpg", kind: "photo", uploadedAt: "2026-07-01T12:00:00+03:00" },
      { id: "sf-5", name: "Технический паспорт.pdf", kind: "document", uploadedAt: "2026-07-01T12:10:00+03:00" },
    ],
    concepts: [
      {
        id: "concept-4",
        label: "Концепция A — мансардный этаж",
        createdAt: "2026-07-14T15:00:00+03:00",
        state: "approved",
        summary: "Мансардный второй этаж со скатной кровлей и террасой со стороны сада.",
        changeExplanation:
          "Добавлен второй этаж и терраса согласно брифу; фасад первого этажа и главный вход сохранены без изменений.",
      },
    ],
    selectedConceptId: "concept-4",
    versions: [
      { id: "v-2", conceptId: "concept-4", label: "Версия 1", createdAt: "2026-07-13T10:00:00+03:00", changeSummary: "Первый вариант мансардного этажа." },
      { id: "v-3", conceptId: "concept-4", label: "Версия 2", createdAt: "2026-07-14T15:00:00+03:00", changeSummary: "Увеличена площадь террасы по просьбе пользователя." },
    ],
    feedback: [
      { id: "f-1", conceptId: "concept-4", author: "Роман", createdAt: "2026-07-13T18:00:00+03:00", comment: "Терраса нравится, но хочется её немного шире." },
    ],
    activity: [
      { id: "a-4", actor: "AI Architect", actorType: "agent", action: "Создана версия 2 концепции A", createdAt: "2026-07-14T15:00:00+03:00" },
      { id: "a-5", actor: "Роман", actorType: "user", action: "Оставлена обратная связь по концепции A", createdAt: "2026-07-13T18:00:00+03:00" },
    ],
  },
  {
    id: "dacha-karelia",
    name: "Дача в Карелии",
    buildingType: "Дачный дом",
    coverImage: "karelia",
    lifecycleStage: "intake",
    state: "draft",
    updatedAt: "2026-07-12T09:15:00+03:00",
    site: {
      address: "Республика Карелия, Прионежский район",
      climateZone: "Холодный, короткое лето",
      areaSqm: 900,
    },
    brief: {
      goal: "Пока не сформулирован — пользователь загрузил только фотографии участка.",
      mustKeep: [],
      mayChange: [],
      wantsChanged: [],
    },
    sourceFiles: [
      { id: "sf-6", name: "Участок — фото 1.jpg", kind: "photo", uploadedAt: "2026-07-12T09:15:00+03:00" },
    ],
    concepts: [],
    selectedConceptId: null,
    versions: [],
    feedback: [],
    activity: [
      { id: "a-6", actor: "Роман", actorType: "user", action: "Проект создан, загружены фото участка", createdAt: "2026-07-12T09:15:00+03:00" },
    ],
  },
  {
    id: "taunhaus-pushkino",
    name: "Таунхаус в Пушкино",
    buildingType: "Таунхаус",
    coverImage: "pushkino",
    lifecycleStage: "concept",
    state: "needs-specialist-review",
    updatedAt: "2026-07-11T16:30:00+03:00",
    site: {
      address: "Московская область, г. Пушкино",
      climateZone: "Умеренный",
      areaSqm: 450,
    },
    brief: {
      goal: "Перепланировать фасад секции таунхауса под общий стиль квартала, сохранив несущие стены.",
      mustKeep: ["Несущие стены", "Высота этажей", "Границы участка секции"],
      mayChange: ["Отделка фасада", "Ограждение палисадника"],
      wantsChanged: ["Единый стиль фасада с соседними секциями"],
    },
    sourceFiles: [
      { id: "sf-7", name: "Фасад секции.jpg", kind: "photo", uploadedAt: "2026-07-05T11:00:00+03:00" },
    ],
    concepts: [
      {
        id: "concept-5",
        label: "Концепция A — единый фасад квартала",
        createdAt: "2026-07-11T16:30:00+03:00",
        state: "needs-specialist-review",
        summary: "Отделка приведена к единому стилю квартала, несущие стены не затронуты.",
        changeExplanation: "Изменена только отделка фасада; конструктивная часть требует проверки специалистом перед утверждением.",
      },
    ],
    selectedConceptId: "concept-5",
    versions: [
      { id: "v-4", conceptId: "concept-5", label: "Версия 1", createdAt: "2026-07-11T16:30:00+03:00", changeSummary: "Первая генерация фасада." },
    ],
    feedback: [],
    activity: [
      { id: "a-7", actor: "Code Compliance Agent", actorType: "agent", action: "Запрошена проверка специалиста перед утверждением", createdAt: "2026-07-11T16:30:00+03:00" },
    ],
  },
  {
    id: "dom-sochi",
    name: "Дом в Сочи",
    buildingType: "Частный дом",
    coverImage: "sochi",
    lifecycleStage: "operation-modernization",
    state: "archived",
    updatedAt: "2026-06-20T08:00:00+03:00",
    site: {
      address: "Краснодарский край, г. Сочи",
      climateZone: "Субтропический, влажный",
      areaSqm: 1800,
    },
    brief: {
      goal: "Проект завершён и передан в эксплуатацию.",
      mustKeep: [],
      mayChange: [],
      wantsChanged: [],
    },
    sourceFiles: [],
    concepts: [
      {
        id: "concept-6",
        label: "Финальная концепция",
        createdAt: "2026-05-02T10:00:00+03:00",
        state: "approved",
        summary: "Утверждённый и реализованный вариант фасада.",
        changeExplanation: "Финальная версия, использованная при строительстве.",
      },
    ],
    selectedConceptId: "concept-6",
    versions: [
      { id: "v-5", conceptId: "concept-6", label: "Версия 3 (финальная)", createdAt: "2026-05-02T10:00:00+03:00", changeSummary: "Финальные правки после проверки специалистом." },
    ],
    feedback: [],
    activity: [
      { id: "a-8", actor: "Роман", actorType: "user", action: "Проект перенесён в архив", createdAt: "2026-06-20T08:00:00+03:00" },
    ],
  },
];

export function getProjectById(id: string): Project | undefined {
  return projects.find((project) => project.id === id);
}

export function getConceptsAwaitingReview(): number {
  return projects.reduce(
    (count, project) => count + project.concepts.filter((c) => c.state === "awaiting-review").length,
    0,
  );
}

export function getApprovedConceptsCount(): number {
  return projects.reduce(
    (count, project) => count + project.concepts.filter((c) => c.state === "approved").length,
    0,
  );
}

export function getActiveProjectsCount(): number {
  return projects.filter((project) => project.state !== "archived").length;
}

export function getRecentActivity(limit = 6) {
  return projects
    .flatMap((project) => project.activity.map((event) => ({ ...event, projectId: project.id, projectName: project.name })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function getPendingDecisions() {
  return projects
    .flatMap((project) =>
      project.concepts
        .filter((c) => c.state === "awaiting-review" || c.state === "needs-specialist-review")
        .map((concept) => ({ concept, project })),
    )
    .sort((a, b) => new Date(b.concept.createdAt).getTime() - new Date(a.concept.createdAt).getTime());
}
