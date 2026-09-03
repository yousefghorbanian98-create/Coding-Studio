import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { FIXTURE_TREE, type FileNode } from "@/services/runtime/workspace";
import { useUiStore } from "@/stores/ui";

const STATUS_MARK: Record<string, { char: string; className: string }> = {
  added: { char: "A", className: "text-[var(--color-ok)]" },
  modified: { char: "M", className: "text-[var(--color-warn)]" },
  deleted: { char: "D", className: "text-[var(--color-danger)]" },
  renamed: { char: "R", className: "text-[var(--color-brand)]" },
};

/** Flattens the visible tree so arrow keys can move linearly through it. */
interface Row {
  node: FileNode;
  depth: number;
}

function flatten(node: FileNode, expanded: Set<string>, depth = 0): Row[] {
  const rows: Row[] = [];
  for (const child of node.children ?? []) {
    rows.push({ node: child, depth });
    if (child.kind === "directory" && expanded.has(child.path)) {
      rows.push(...flatten(child, expanded, depth + 1));
    }
  }
  return rows;
}

export function Explorer(): React.ReactElement {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["src", "src/components", "src/services"]),
  );
  const [active, setActive] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    path: string;
    x: number;
    y: number;
  } | null>(null);
  const requestComposerFocus = useUiStore(
    (state) => state.requestComposerFocus,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape closes the menu. Outside clicks are handled by a backdrop element
  // rather than a document listener, because a document listener fires before
  // React's synthetic click and would tear the menu down before the chosen
  // item's own handler could run.
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const copyPath = (path: string): void => {
    void navigator.clipboard?.writeText(path).catch(() => {
      // Clipboard can be denied; silence beats a crash.
    });
    setMenu(null);
  };

  const rows = useMemo(() => flatten(FIXTURE_TREE, expanded), [expanded]);

  const toggle = (path: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const activate = (row: Row): void => {
    setActive(row.node.path);
    if (row.node.kind === "directory") toggle(row.node.path);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const row = rows[index];
    if (!row) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = rows[index + delta];
      if (next) {
        setActive(next.node.path);
        document
          .querySelector<HTMLElement>(`[data-tree-path="${next.node.path}"]`)
          ?.focus();
      }
      return;
    }
    if (event.key === "ArrowRight" && row.node.kind === "directory") {
      event.preventDefault();
      if (!expanded.has(row.node.path)) toggle(row.node.path);
      return;
    }
    if (event.key === "ArrowLeft" && row.node.kind === "directory") {
      event.preventDefault();
      if (expanded.has(row.node.path)) toggle(row.node.path);
    }
  };

  return (
    <div className="flex min-h-0 flex-col" data-testid="explorer">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          {t("explorer.title")}
        </h2>
        <button
          type="button"
          onClick={() => setExpanded(new Set())}
          data-testid="explorer-collapse"
          title={t("explorer.collapseAll")}
          aria-label={t("explorer.collapseAll")}
          className="rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          <Icon name="chevron" size={12} className="-rotate-90" />
        </button>
      </div>

      <ul
        role="tree"
        aria-label={t("explorer.title")}
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-2"
      >
        {rows.length === 0 ? (
          <li
            data-testid="explorer-empty"
            className="px-2 py-6 text-center text-[11px] text-[var(--color-ink-soft)]"
          >
            {t("explorer.empty")}
          </li>
        ) : null}
        {rows.map((row, index) => {
          const isDir = row.node.kind === "directory";
          const open = expanded.has(row.node.path);
          const mark = row.node.status
            ? STATUS_MARK[row.node.status]
            : undefined;

          return (
            <li
              key={row.node.path}
              role="treeitem"
              aria-expanded={isDir ? open : undefined}
              aria-selected={active === row.node.path}
            >
              <button
                type="button"
                data-tree-path={row.node.path}
                data-testid={`tree-${row.node.path}`}
                tabIndex={
                  active === row.node.path || (active === null && index === 0)
                    ? 0
                    : -1
                }
                onClick={() => activate(row)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setActive(row.node.path);
                  setMenu({
                    path: row.node.path,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                onKeyDown={(event) => onKeyDown(event, index)}
                style={{ paddingInlineStart: `${row.depth * 12 + 6}px` }}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-start text-xs",
                  "transition-colors hover:bg-[var(--color-surface-2)]",
                  active === row.node.path
                    ? "bg-[var(--color-surface-2)] text-[var(--color-ink)]"
                    : "text-[var(--color-ink-soft)]",
                  row.node.status === "deleted" && "line-through",
                )}
              >
                {isDir ? (
                  <Icon
                    name="chevron"
                    size={11}
                    className={cn("shrink-0", open && "rotate-90")}
                  />
                ) : (
                  <span className="w-[11px] shrink-0" />
                )}
                <Icon
                  name={isDir ? "sessions" : "files"}
                  size={12}
                  className="shrink-0"
                />
                <span title={row.node.path} className="min-w-0 flex-1 truncate">
                  {row.node.name}
                </span>
                {mark ? (
                  <span
                    aria-label={t(`explorer.status.${row.node.status ?? ""}`)}
                    className={cn(
                      "shrink-0 text-[10px] font-bold",
                      mark.className,
                    )}
                  >
                    {mark.char}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {menu ? (
        <>
          <div
            data-testid="explorer-menu-backdrop"
            onClick={() => setMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu(null);
            }}
            className="fixed inset-0 z-40"
          />
          <div
            ref={menuRef}
            role="menu"
            data-testid="explorer-menu"
            aria-label={t("explorer.menu.title")}
            style={{ top: menu.y, left: menu.x }}
            className={cn(
              "fixed z-50 min-w-44 overflow-hidden rounded-md border",
              "border-[var(--color-line)] bg-[var(--color-surface)] py-1 shadow-lg",
            )}
          >
            <button
              type="button"
              role="menuitem"
              data-testid="explorer-menu-copy"
              onClick={() => copyPath(menu.path)}
              className="block w-full px-3 py-1.5 text-start text-[11px] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
            >
              {t("explorer.menu.copyPath")}
            </button>
            <button
              type="button"
              role="menuitem"
              data-testid="explorer-menu-context"
              onClick={() => {
                requestComposerFocus();
                setMenu(null);
              }}
              className="block w-full px-3 py-1.5 text-start text-[11px] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
            >
              {t("explorer.menu.addToContext")}
            </button>
            <button
              type="button"
              role="menuitem"
              // Revealing in Explorer needs the OS shell, which this build has
              // no access to. Disabled and explained rather than dead.
              aria-disabled="true"
              data-testid="explorer-menu-reveal"
              title={t("explorer.menu.revealHint")}
              className="block w-full cursor-not-allowed px-3 py-1.5 text-start text-[11px] text-[var(--color-ink-soft)]"
            >
              {t("explorer.menu.reveal")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
