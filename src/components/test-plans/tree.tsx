"use client";

import { ChevronRight, Folder, FolderPlus, Layers, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreButton } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { type CaseSummary, childrenOf, countByNode, type Project, subtreeIds, type TreeNode } from "@/lib/test-plans/model";
import { NameDialog } from "./name-dialog";

export type Scope = { projectId: string; nodeId: string | null };

const OPEN_KEY = "tp-open";

function readOpen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

type Naming = { title: string; label: string; initial: string; action: string; submit: (name: string) => Promise<void> };

/** Projects, suites and folders. Open folders are remembered in this browser, also after a refresh. */
export function PlanTree({
  projects,
  nodes,
  cases,
  scope,
  canWrite,
  onSelect,
  onChanged,
}: {
  projects: Project[];
  nodes: TreeNode[];
  cases: CaseSummary[];
  scope: Scope | null;
  canWrite: boolean;
  onSelect: (scope: Scope) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [naming, setNaming] = useState<Naming | null>(null);
  const confirm = useConfirm();
  const counts = countByNode(nodes, cases);

  useEffect(() => {
    // localStorage is only there in the browser, so it is read after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(readOpen());
  }, []);

  // The selected project and the selected node's parents open by themselves, so a link to a folder
  // shows where it is.
  const selected = scope?.nodeId;
  const selectedProject = scope?.projectId;
  useEffect(() => {
    if (!selectedProject) return;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const wanted = [selectedProject];
    for (let n = selected ? byId.get(selected) : undefined; n?.parentId; n = byId.get(n.parentId)) wanted.push(n.parentId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen((current) => (wanted.every((id) => current.has(id)) ? current : new Set([...current, ...wanted])));
  }, [selected, selectedProject, nodes]);

  function toggle(id: string, value?: boolean) {
    setOpen((current) => {
      const next = new Set(current);
      if (value ?? !next.has(id)) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      } catch {
        // private windows may refuse storage; the tree still works
      }
      return next;
    });
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function addNode(projectId: string, parent: TreeNode | null) {
    setNaming({
      title: parent ? `New folder in ${parent.name}` : "New suite",
      label: "Name",
      initial: "",
      action: parent ? "Add folder" : "Add suite",
      submit: async (name) => {
        const { id } = await api<{ id: string }>("/api/test-plans/nodes", { body: { projectId, parentId: parent?.id ?? null, name } });
        toggle(parent?.id ?? projectId, true);
        onChanged();
        onSelect({ projectId, nodeId: id });
      },
    });
  }

  function nodeMenu(node: TreeNode, index: number, total: number) {
    const ids = subtreeIds(nodes, node.id);
    const folders = ids.length - 1;
    const inside = cases.filter((c) => ids.includes(c.nodeId)).length;
    const what = [folders ? plural(folders, "folder") : null, inside ? plural(inside, "test case") : null].filter(Boolean).join(" and ");
    return (
      <DropdownMenu>
        <MoreButton label={`Actions for ${node.name}`} className="size-6" />
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => addNode(node.projectId, node)}>Add folder</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              setNaming({
                title: `Rename ${node.kind}`,
                label: "Name",
                initial: node.name,
                action: "Rename",
                submit: async (name) => {
                  await api(`/api/test-plans/nodes/${node.id}`, { method: "PATCH", body: { name } });
                  onChanged();
                },
              })
            }
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === 0} onSelect={() => run(() => api(`/api/test-plans/nodes/${node.id}`, { method: "PATCH", body: { move: "up" } }), "Moved up.")}>
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === total - 1} onSelect={() => run(() => api(`/api/test-plans/nodes/${node.id}`, { method: "PATCH", body: { move: "down" } }), "Moved down.")}>
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            danger
            onSelect={() =>
              confirm.ask(
                `Delete this ${node.kind}?`,
                <>
                  {node.name}
                  {what ? ` and its ${what}` : ""} will go to Deleted. You can restore {what ? "them" : "it"} from there.
                </>,
                "Delete",
                () =>
                  run(async () => {
                    await api(`/api/test-plans/nodes/${node.id}`, { method: "DELETE" });
                    if (scope && ids.includes(scope.nodeId ?? "")) onSelect({ projectId: node.projectId, nodeId: null });
                  }, `${node.kind === "suite" ? "Suite" : "Folder"} moved to Deleted.`),
              )
            }
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderNodes(projectId: string, parentId: string | null, depth: number): React.ReactNode {
    const children = childrenOf(nodes, projectId, parentId);
    if (!children.length) return null;
    return (
      <ul role="group">
        {children.map((node, index) => {
          const hasChildren = nodes.some((n) => n.parentId === node.id);
          const isOpen = open.has(node.id);
          const active = scope?.nodeId === node.id;
          return (
            <li key={node.id} role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={active}>
              <Row
                depth={depth}
                active={active}
                count={counts.get(node.id) ?? 0}
                icon={node.kind === "suite" ? Layers : Folder}
                label={node.name}
                expandable={hasChildren}
                open={isOpen}
                onToggle={() => toggle(node.id)}
                onSelect={() => onSelect({ projectId, nodeId: node.id })}
                actions={canWrite ? nodeMenu(node, index, children.length) : null}
              />
              {hasChildren && isOpen ? renderNodes(projectId, node.id, depth + 1) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-ink">Projects</h2>
        {canWrite ? (
          <Tooltip content="New project">
            <Button
              size="sm"
              icon
              aria-label="New project"
              onClick={() =>
                setNaming({
                  title: "New project",
                  label: "Name",
                  initial: "",
                  action: "Create project",
                  submit: async (name) => {
                    const { id } = await api<{ id: string }>("/api/test-plans/projects", { body: { name } });
                    toggle(id, true);
                    onChanged();
                    onSelect({ projectId: id, nodeId: null });
                  },
                })
              }
            >
              <Plus className="size-4" />
            </Button>
          </Tooltip>
        ) : null}
      </div>
      {projects.length === 0 ? (
        <p className="px-3 pb-3 text-sm text-muted">{canWrite ? "No projects yet. Create one to add suites." : "No projects yet."}</p>
      ) : (
        <ul role="tree" aria-label="Projects, suites and folders" className="px-1.5 pb-2">
          {projects.map((project) => {
            const isOpen = open.has(project.id);
            const total = cases.filter((c) => c.projectId === project.id).length;
            return (
              <li key={project.id} role="treeitem" aria-expanded={isOpen} aria-selected={scope?.projectId === project.id && !scope.nodeId}>
                <Row
                  depth={0}
                  strong
                  active={scope?.projectId === project.id && !scope.nodeId}
                  count={total}
                  label={project.name}
                  expandable
                  open={isOpen}
                  onToggle={() => toggle(project.id)}
                  onSelect={() => {
                    onSelect({ projectId: project.id, nodeId: null });
                    if (!isOpen) toggle(project.id, true);
                  }}
                  actions={
                    canWrite ? (
                      <>
                        <Tooltip content="Add suite">
                          <button type="button" aria-label={`Add suite to ${project.name}`} onClick={() => addNode(project.id, null)} className="rounded p-1 text-muted hover:bg-hover hover:text-ink">
                            <FolderPlus className="size-3.5" />
                          </button>
                        </Tooltip>
                        <DropdownMenu>
                          <MoreButton label={`Actions for ${project.name}`} className="size-6" />
                          <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => addNode(project.id, null)}>Add suite</DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                setNaming({
                                  title: "Rename project",
                                  label: "Name",
                                  initial: project.name,
                                  action: "Rename",
                                  submit: async (name) => {
                                    await api(`/api/test-plans/projects/${project.id}`, { method: "PATCH", body: { name } });
                                    onChanged();
                                  },
                                })
                              }
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              danger
                              onSelect={() => {
                                const suites = nodes.filter((n) => n.projectId === project.id && !n.parentId).length;
                                confirm.ask(
                                  "Delete this project?",
                                  <>
                                    {project.name} with {plural(suites, "suite")} and {plural(total, "test case")} will go to Deleted. You can restore it from there.
                                  </>,
                                  "Delete",
                                  () =>
                                    run(async () => {
                                      await api(`/api/test-plans/projects/${project.id}`, { method: "DELETE" });
                                      if (scope?.projectId === project.id) onSelect({ projectId: "", nodeId: null });
                                    }, "Project moved to Deleted."),
                                );
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : null
                  }
                />
                {isOpen ? (
                  nodes.some((n) => n.projectId === project.id && !n.parentId) ? (
                    renderNodes(project.id, null, 1)
                  ) : (
                    <p className="py-1 pr-2 pl-9 text-sm text-faint">No suites yet</p>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {naming ? <NameDialog {...naming} onClose={() => setNaming(null)} /> : null}
      {confirm.dialog}
    </div>
  );
}

/** One tree row: the buttons show on hover or keyboard focus, otherwise the test case count. */
function Row({
  depth,
  label,
  count,
  icon: Icon,
  active,
  strong,
  expandable,
  open,
  onToggle,
  onSelect,
  actions,
}: {
  depth: number;
  label: string;
  count: number;
  icon?: React.ElementType;
  active: boolean;
  strong?: boolean;
  expandable: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
  actions: React.ReactNode;
}) {
  return (
    <div
      className={cn("group relative flex h-8 items-center gap-1 rounded-md pr-1 text-base", active ? "bg-accent-soft text-ink" : "hover:bg-hover")}
      style={{ paddingLeft: 4 + depth * 14 }}
    >
      <button
        type="button"
        tabIndex={expandable ? 0 : -1}
        aria-label={expandable ? `${open ? "Close" : "Open"} ${label}` : undefined}
        aria-hidden={!expandable}
        onClick={onToggle}
        className={cn("flex size-5 shrink-0 items-center justify-center rounded text-muted hover:text-ink", !expandable && "invisible")}
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch text-left" title={label}>
        {Icon ? <Icon className="size-3.5 shrink-0 text-muted" aria-hidden /> : null}
        <span className={cn("truncate", strong && "font-medium")}>{label}</span>
      </button>
      <span className={cn("tabular shrink-0 px-1 text-sm text-faint", actions && "group-hover:hidden group-focus-within:hidden group-has-[[data-state=open]]:hidden")}>{count}</span>
      {actions ? (
        <div className="hidden shrink-0 items-center group-hover:flex group-focus-within:flex has-[[data-state=open]]:flex">{actions}</div>
      ) : null}
    </div>
  );
}
