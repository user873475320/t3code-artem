import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";
import {
  CustomSectionsSchema,
  groupCustomSections,
  INITIAL_CUSTOM_SECTIONS,
  moveSectionThread,
  removeCustomSection,
  reorderCustomSection,
  sectionForThread,
  UNASSIGNED_SECTION,
} from "./customSections";

const decodeSections = Schema.decodeSync(Schema.fromJsonString(CustomSectionsSchema));

describe("personal sidebar sections", () => {
  const first = INITIAL_CUSTOM_SECTIONS.sections[0]!.id;
  const second = INITIAL_CUSTOM_SECTIONS.sections[1]!.id;
  it("keeps equal thread IDs on different environments independent across a storage round trip", () => {
    const a = moveSectionThread(INITIAL_CUSTOM_SECTIONS, "mac:thread", first);
    const b = moveSectionThread(a, "vps:thread", second);
    const restored = decodeSections(JSON.stringify(b));
    expect(sectionForThread(restored, "mac:thread")).toBe(first);
    expect(sectionForThread(restored, "vps:thread")).toBe(second);
  });
  it("preserves filtered and disconnected threads and returns them in their saved order", () => {
    let state = moveSectionThread(INITIAL_CUSTOM_SECTIONS, "a", first);
    state = moveSectionThread(state, "offline", first);
    state = moveSectionThread(state, "b", first, { key: "a", after: false });
    expect(groupCustomSections(state, ["a", "b"], String)[0]!.threads).toEqual(["b", "a"]);
    expect(groupCustomSections(state, ["offline", "a", "b"], String)[0]!.threads).toEqual([
      "b",
      "a",
      "offline",
    ]);
  });
  it("moves across sections without duplicates and preserves independent native statuses", () => {
    const thread = { key: "a", settledAt: "2026-11-12", pinnedAt: null };
    const state = moveSectionThread(
      moveSectionThread(INITIAL_CUSTOM_SECTIONS, thread.key, first),
      thread.key,
      second,
    );
    const groups = groupCustomSections(state, [thread], (value) => value.key);
    expect(groups[0]!.threads).toEqual([]);
    expect(groups[1]!.threads).toEqual([thread]);
    expect(groups[1]!.threads[0]).toBe(thread);
  });
  it("deleting a section keeps every thread, including unavailable ones, in unassigned", () => {
    let state = moveSectionThread(INITIAL_CUSTOM_SECTIONS, "offline", first);
    state = moveSectionThread(state, "a", first);
    state = removeCustomSection(state, first);
    expect(state.unassignedOrder).toEqual(["offline", "a"]);
    expect(groupCustomSections(state, ["a", "offline", "new"], String).at(-1)!.threads).toEqual([
      "offline",
      "a",
      "new",
    ]);
    expect(sectionForThread(state, "a")).toBe(UNASSIGNED_SECTION);
  });
  it("ignores stale targets and self drops and bounds section reordering", () => {
    expect(moveSectionThread(INITIAL_CUSTOM_SECTIONS, "a", "deleted")).toBe(
      INITIAL_CUSTOM_SECTIONS,
    );
    expect(moveSectionThread(INITIAL_CUSTOM_SECTIONS, "a", first, { key: "a", after: true })).toBe(
      INITIAL_CUSTOM_SECTIONS,
    );
    expect(reorderCustomSection(INITIAL_CUSTOM_SECTIONS, first, -1)).toBe(INITIAL_CUSTOM_SECTIONS);
    expect(reorderCustomSection(INITIAL_CUSTOM_SECTIONS, second, -1).sections[0]!.id).toBe(second);
  });
});
