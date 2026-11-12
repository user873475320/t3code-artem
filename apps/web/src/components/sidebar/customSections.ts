import * as Schema from "effect/Schema";

export const UNASSIGNED_SECTION = "__unassigned__";
export const CUSTOM_SECTIONS_KEY = "t3code-artem:sections:v1";
export const CustomSectionsSchema = Schema.Struct({
  enabled: Schema.Boolean,
  sections: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      collapsed: Schema.Boolean,
      threadKeys: Schema.Array(Schema.String),
    }),
  ),
  unassignedOrder: Schema.Array(Schema.String),
});
export type CustomSectionsState = typeof CustomSectionsSchema.Type;
export type CustomSection = CustomSectionsState["sections"][number];

export const INITIAL_CUSTOM_SECTIONS: CustomSectionsState = {
  enabled: false,
  sections: [
    "Закреплённые",
    "ПК",
    "Разработка",
    "Минорные изменения",
    "Идеальное усвоение",
    "Геймификация",
  ].map((name, index) => ({ id: `section-${index}`, name, collapsed: false, threadKeys: [] })),
  unassignedOrder: [],
};

export function sectionForThread(state: CustomSectionsState, key: string): string {
  return (
    state.sections.find((section) => section.threadKeys.includes(key))?.id ?? UNASSIGNED_SECTION
  );
}

/** Keys include the environment ID. Never prune missing keys: a remote may be offline or filtered. */
export function groupCustomSections<T>(
  state: CustomSectionsState,
  threads: readonly T[],
  keyOf: (thread: T) => string,
): { section: CustomSection; threads: T[] }[] {
  const byKey = new Map(threads.map((thread) => [keyOf(thread), thread]));
  const take = (keys: readonly string[]) =>
    keys.flatMap((key) => {
      const thread = byKey.get(key);
      if (thread === undefined) return [];
      byKey.delete(key);
      return [thread];
    });
  const groups = state.sections.map((section) => ({ section, threads: take(section.threadKeys) }));
  const ordered = take(state.unassignedOrder);
  return [
    ...groups,
    {
      section: { id: UNASSIGNED_SECTION, name: "Без раздела", collapsed: false, threadKeys: [] },
      threads: [...ordered, ...byKey.values()],
    },
  ];
}

export function moveSectionThread(
  state: CustomSectionsState,
  key: string,
  targetId: string,
  relativeTo?: { key: string; after: boolean },
): CustomSectionsState {
  if (relativeTo?.key === key) return state;
  if (targetId !== UNASSIGNED_SECTION && !state.sections.some((section) => section.id === targetId))
    return state;
  const remove = (keys: readonly string[]) => keys.filter((item) => item !== key);
  const insert = (keys: readonly string[]) => {
    const next = remove(keys);
    const index = relativeTo ? next.indexOf(relativeTo.key) : -1;
    next.splice(index < 0 ? next.length : index + Number(relativeTo?.after), 0, key);
    return next;
  };
  return {
    ...state,
    sections: state.sections.map((section) => ({
      ...section,
      threadKeys: section.id === targetId ? insert(section.threadKeys) : remove(section.threadKeys),
    })),
    unassignedOrder:
      targetId === UNASSIGNED_SECTION
        ? insert(state.unassignedOrder)
        : remove(state.unassignedOrder),
  };
}

export function removeCustomSection(state: CustomSectionsState, id: string): CustomSectionsState {
  const removed = state.sections.find((section) => section.id === id);
  if (!removed) return state;
  return {
    ...state,
    sections: state.sections.filter((section) => section.id !== id),
    unassignedOrder: [...new Set([...state.unassignedOrder, ...removed.threadKeys])],
  };
}

export function reorderCustomSection(
  state: CustomSectionsState,
  id: string,
  direction: -1 | 1,
): CustomSectionsState {
  const index = state.sections.findIndex((section) => section.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.sections.length) return state;
  const sections = [...state.sections];
  const section = sections.splice(index, 1)[0]!;
  sections.splice(target, 0, section);
  return { ...state, sections };
}
