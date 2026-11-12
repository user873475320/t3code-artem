import { createMemoryHistory } from "@tanstack/react-router";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { AppRoot } from "~/AppRoot";
// The thread route loads ChatView lazily; its first transform would eat the test's timeout.
import "~/components/ChatView";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { getRouter } from "~/router";
import {
  ENVIRONMENT_ID,
  installFakeEnvironment,
  threadWithHistory,
  type FakeDriver,
} from "../../test/fakeEnvironment";
import { act, render } from "../../test/render";
import { getLocalStorageItem, removeLocalStorageItem } from "../hooks/useLocalStorage";
import {
  CUSTOM_SECTIONS_KEY,
  CustomSectionsSchema,
  sectionForThread,
} from "./sidebar/customSections";

// The socket is the only fake layer; see test/appScenarios.renders.tsx.
vi.mock("../../../../packages/client-runtime/src/connection/driver.ts", async (importOriginal) => {
  const [actual, { fakeDriver }, Layer] = await Promise.all([
    importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
    import("../../test/fakeEnvironment"),
    import("effect/Layer"),
  ]);
  return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
});

vi.mock(import("~/rpc/requestLatencyState"), async (original) => ({
  ...(await original()),
  trackRpcRequestSent: () => {},
}));

it("moves a thread into a collapsed personal section and retains the assignment after remount", async () => {
  await page.viewport(1400, 900);
  removeLocalStorageItem(CUSTOM_SECTIONS_KEY);
  using _storage = { [Symbol.dispose]: () => removeLocalStorageItem(CUSTOM_SECTIONS_KEY) };
  const thread = threadWithHistory("personal-section", 1);
  using _environment = installFakeEnvironment([thread]);
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    boringSidebarEnabled: true,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  });
  const router = getRouter(
    createMemoryHistory({ initialEntries: [`/${ENVIRONMENT_ID}/${thread.id}`] }),
  );
  await router.load();
  {
    await using _app = await render(<AppRoot router={router} />, { router: false });
    await expect
      .element(page.getByRole("button", { name: /^render/ }))
      .toHaveAttribute("aria-expanded", "true");
    await userEvent.click(page.getByRole("button", { name: "Включить мои разделы" }));
    const target = page.getByRole("button", { name: "Разработка: 0", exact: true });
    await userEvent.click(target);
    await expect.element(target).toHaveAttribute("aria-expanded", "false");
    const row = page.getByRole("button", { name: new RegExp(thread.title) }).first();
    await expect.element(row).toBeVisible();
    const from = row.element().getBoundingClientRect();
    const to = target.element().getBoundingClientRect();
    const pointer = (type: string, x: number, y: number) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        clientX: x,
        clientY: y,
      });
    using _release = { [Symbol.dispose]: () => document.dispatchEvent(pointer("pointerup", 0, 0)) };
    await act(() => {
      row.element().dispatchEvent(pointer("pointerdown", from.x + 30, from.y + 10));
    });
    await act(() => {
      document.dispatchEvent(pointer("pointermove", from.x + 30, from.y - 10));
    });
    await act(() => {
      document.dispatchEvent(pointer("pointermove", to.x + 40, to.y + 12));
    });
    await act(() => {
      document.dispatchEvent(pointer("pointerup", to.x + 40, to.y + 12));
    });
    await expect
      .element(page.getByRole("button", { name: "Разработка: 1", exact: true }))
      .toBeVisible();
    const state = getLocalStorageItem(CUSTOM_SECTIONS_KEY, CustomSectionsSchema)!;
    expect(sectionForThread(state, `${ENVIRONMENT_ID}:${thread.id}`)).toBe("section-2");
  }
  await using _app = await render(<AppRoot router={router} />, { router: false });
  await expect
    .element(page.getByRole("button", { name: "Разработка: 1", exact: true }))
    .toHaveAttribute("aria-expanded", "false");
  await userEvent.click(page.getByRole("button", { name: "Разработка: 1", exact: true }));
  await expect
    .element(page.getByRole("button", { name: new RegExp(thread.title) }).first())
    .toBeVisible();
});
