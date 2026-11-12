import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { ChevronDownIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState, type ReactNode, type RefCallback } from "react";
import { cn, randomUUID } from "~/lib/utils";
import { SidebarPointerSensor } from "../Sidebar.pointer";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "../ui/dialog";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "../ui/menu";
import { TooltipProvider } from "../ui/tooltip";
import {
  groupCustomSections,
  parseCustomSectionsSnapshot,
  moveSectionThread,
  removeCustomSection,
  reorderCustomSection,
  UNASSIGNED_SECTION,
  type CustomSection,
  type CustomSectionsState,
} from "./customSections";

const threadKey = (thread: EnvironmentThreadShell) =>
  scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
const dropId = (id: string) => `personal-section:${id}`;
type SetSections = (update: (state: CustomSectionsState) => CustomSectionsState) => void;

function SectionGroup(props: {
  section: CustomSection;
  threads: readonly EnvironmentThreadShell[];
  renderRow: (thread: EnvironmentThreadShell, parent: string) => ReactNode;
  setState: SetSections;
  onRename: () => void;
  first: boolean;
  last: boolean;
}) {
  const { section, threads, setState } = props;
  const { setNodeRef, isOver } = useDroppable({ id: dropId(section.id) });
  const custom = section.id !== UNASSIGNED_SECTION;
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "mt-3 list-none first:mt-0",
        isOver && "rounded-md bg-sidebar-row-hover ring-1 ring-ring",
      )}
    >
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          aria-label={`${section.name}: ${threads.length}`}
          data-sidebar-row={dropId(section.id)}
          aria-expanded={!section.collapsed}
          onClick={() =>
            custom &&
            setState((state) => ({
              ...state,
              sections: state.sections.map((item) =>
                item.id === section.id ? { ...item, collapsed: !item.collapsed } : item,
              ),
            }))
          }
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-2 text-left text-xs text-sidebar-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ChevronDownIcon
            aria-hidden
            className={cn("size-3 shrink-0", section.collapsed && "-rotate-90")}
          />
          <span className="truncate">{section.name}</span>
          <span className="ml-auto tabular-nums">{threads.length}</span>
        </button>
        {custom ? (
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Действия раздела ${section.name}`}
                />
              }
            >
              <MoreHorizontalIcon />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem onClick={props.onRename}>Переименовать</MenuItem>
              <MenuItem
                disabled={props.first}
                onClick={() => setState((state) => reorderCustomSection(state, section.id, -1))}
              >
                Выше
              </MenuItem>
              <MenuItem
                disabled={props.last}
                onClick={() => setState((state) => reorderCustomSection(state, section.id, 1))}
              >
                Ниже
              </MenuItem>
              <MenuItem onClick={() => setState((state) => removeCustomSection(state, section.id))}>
                Удалить раздел, сохранить чаты
              </MenuItem>
            </MenuPopup>
          </Menu>
        ) : null}
      </div>
      {!section.collapsed ? (
        <SortableContext items={threads.map(threadKey)} strategy={verticalListSortingStrategy}>
          <ul role="presentation" className="flex flex-col gap-px">
            {threads.map((thread) => props.renderRow(thread, dropId(section.id)))}
            {threads.length === 0 ? (
              <li className="list-none px-2 py-2 text-xs text-sidebar-muted-foreground/60">
                Перетащите сюда чат
              </li>
            ) : null}
          </ul>
        </SortableContext>
      ) : null}
    </li>
  );
}

export function CustomSidebarSections({
  state,
  setState,
  threads,
  renderRow,
  drafts,
  more,
  treeRef,
}: {
  state: CustomSectionsState;
  setState: SetSections;
  threads: readonly EnvironmentThreadShell[];
  renderRow: (thread: EnvironmentThreadShell, parent: string) => ReactNode;
  drafts: ReactNode;
  more: ReactNode;
  treeRef: RefCallback<HTMLUListElement>;
}) {
  const [editing, setEditing] = useState<{ id: string | null; name: string } | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const importedState = snapshot === null ? null : parseCustomSectionsSnapshot(snapshot);
  const sensors = useSensors(
    useSensor(SidebarPointerSensor, { distance: 6, onAttach: () => {}, onFinish: () => {} }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const groups = groupCustomSections(state, threads, threadKey);
  const names = state.sections
    .filter((section) => section.id !== editing?.id)
    .map((section) => section.name.toLocaleLowerCase());
  const name = editing?.name.trim() ?? "";
  const duplicate = names.includes(name.toLocaleLowerCase());
  return (
    <>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-sidebar-muted-foreground">Мои разделы</span>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Перенести разделы"
            title="Импорт и экспорт разделов"
            onClick={() => setSnapshot(JSON.stringify(state, null, 2))}
          >
            <MoreHorizontalIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Добавить раздел"
            onClick={() => setEditing({ id: null, name: "" })}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>
      <TooltipProvider delay={150}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const key = String(active.id);
            const group = groups.find(
              ({ section, threads }) =>
                dropId(section.id) === over.id ||
                threads.some((thread) => threadKey(thread) === over.id),
            );
            if (!group) return;
            const relativeTo = String(over.id).startsWith("personal-section:")
              ? undefined
              : {
                  key: String(over.id),
                  after: (active.rect.current.translated?.top ?? 0) > over.rect.top,
                };
            setState((state) =>
              moveSectionThread(
                {
                  ...state,
                  unassignedOrder: [
                    ...new Set([
                      ...state.unassignedOrder,
                      ...groups.at(-1)!.threads.map(threadKey),
                    ]),
                  ],
                },
                key,
                group.section.id,
                relativeTo,
              ),
            );
          }}
        >
          <ul role="presentation" ref={treeRef}>
            {drafts}
            {groups.map(({ section, threads }, index) => (
              <SectionGroup
                key={section.id}
                section={section}
                threads={threads}
                renderRow={renderRow}
                setState={setState}
                first={index === 0}
                last={index === state.sections.length - 1}
                onRename={() => setEditing({ id: section.id, name: section.name })}
              />
            ))}
            {more}
          </ul>
        </DndContext>
      </TooltipProvider>
      {snapshot !== null ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSnapshot(null);
          }}
        >
          <DialogPopup>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!importedState) return;
                setState(() => importedState);
                setSnapshot(null);
              }}
            >
              <DialogHeader>
                <DialogTitle>Перенести разделы</DialogTitle>
                <DialogDescription>
                  Скопируйте текущую структуру или вставьте сохранённую. Применение заменит разделы,
                  их порядок и распределение чатов. Сами чаты сохранятся.
                </DialogDescription>
              </DialogHeader>
              <DialogPanel>
                <Textarea
                  aria-label="Структура разделов JSON"
                  rows={8}
                  value={snapshot}
                  onChange={(event) => setSnapshot(event.target.value)}
                />
                <p className="mt-2 text-sm text-muted-foreground" role="status">
                  {importedState
                    ? `${importedState.sections.length} разделов, ${importedState.sections.reduce((sum, section) => sum + section.threadKeys.length, 0)} привязок чатов. Чаты из другой среды нужно импортировать отдельно.`
                    : "Некорректная структура: проверьте формат, названия и повторяющиеся чаты."}
                </p>
              </DialogPanel>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setSnapshot(null)}>
                  Закрыть
                </Button>
                <Button type="submit" disabled={!importedState}>
                  Применить структуру
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </Dialog>
      ) : null}
      {editing ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        >
          <DialogPopup>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!name || duplicate) return;
                const id = editing.id ?? randomUUID();
                setState((state) => ({
                  ...state,
                  sections:
                    editing.id === null
                      ? [...state.sections, { id, name, collapsed: false, threadKeys: [] }]
                      : state.sections.map((section) =>
                          section.id === id ? { ...section, name } : section,
                        ),
                }));
                setEditing(null);
              }}
            >
              <DialogHeader>
                <DialogTitle>{editing.id ? "Переименовать раздел" : "Новый раздел"}</DialogTitle>
                <DialogDescription>
                  Разделы и их порядок сохраняются в этом приложении на этом компьютере.
                </DialogDescription>
              </DialogHeader>
              <DialogPanel>
                <Input
                  aria-label="Название раздела"
                  maxLength={80}
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
                {duplicate ? (
                  <p className="mt-2 text-sm text-destructive">Такой раздел уже есть.</p>
                ) : null}
              </DialogPanel>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditing(null)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={!name || duplicate}>
                  Сохранить
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </Dialog>
      ) : null}
    </>
  );
}
