"use client";

import { FolderPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import type { SelectionItem } from "@/lib/automation/types";
import { api } from "@/lib/client/api";

type SuiteOption = { id: string; name: string };

/** A menu of suites; picking one adds the run (or the given items) to it. */
export function AddToSuite({ runId, items, size = "sm" }: { runId?: string; items?: SelectionItem[]; size?: "sm" | "md" }) {
  const [suites, setSuites] = useState<SuiteOption[] | null>(null);

  async function load(open: boolean) {
    if (!open || suites) return;
    try {
      const data = await api<{ suites: SuiteOption[] }>("/api/automation/suites");
      setSuites(data.suites);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function add(suite: SuiteOption) {
    try {
      await api(`/api/automation/suites/${suite.id}/items`, { body: runId ? { runId } : { items } });
      toast.success(`Added to ${suite.name}.`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <DropdownMenu onOpenChange={load}>
      <DropdownMenuTrigger asChild>
        <Button size={size}>
          <FolderPlus className="size-3.5" aria-hidden /> Add to suite
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {suites === null ? <DropdownMenuItem disabled>Loading suites...</DropdownMenuItem> : null}
        {suites?.length === 0 ? <DropdownMenuItem disabled>No suites yet</DropdownMenuItem> : null}
        {suites?.map((suite) => (
          <DropdownMenuItem key={suite.id} onSelect={() => add(suite)}>
            <span className="truncate">{suite.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/automation-test/suites/new">New suite</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same choice as a submenu, for the run details menu. */
export function AddToSuiteSubmenu({ runId }: { runId: string }) {
  const [suites, setSuites] = useState<SuiteOption[] | null>(null);

  async function load(open: boolean) {
    if (!open || suites) return;
    try {
      setSuites((await api<{ suites: SuiteOption[] }>("/api/automation/suites")).suites);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function add(suite: SuiteOption) {
    try {
      await api(`/api/automation/suites/${suite.id}/items`, { body: { runId } });
      toast.success(`Added to ${suite.name}.`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <DropdownMenuSub onOpenChange={load}>
      <DropdownMenuSubTrigger>Add to suite</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {suites === null ? <DropdownMenuItem disabled>Loading suites...</DropdownMenuItem> : null}
        {suites?.length === 0 ? <DropdownMenuItem disabled>No suites yet</DropdownMenuItem> : null}
        {suites?.map((suite) => (
          <DropdownMenuItem key={suite.id} onSelect={() => add(suite)}>
            <span className="truncate">{suite.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
