import React from "react";
import {
  ChevronRight,
  FolderPlus,
  Home,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FilesViewMode } from "@/store/types";
import type { Crumb } from "./types";

type Props = {
  viewMode: FilesViewMode;
  onViewModeChange: (mode: FilesViewMode) => void;
  /** Hide My files / Shared toggle (e.g. anonymous public browse). */
  hideViewSwitcher?: boolean;
  readOnly: boolean;
  crumbs: Crumb[];
  onNavigateCrumb: (index: number) => void;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  loading: boolean;
  onUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function DashboardToolbar({
  viewMode,
  onViewModeChange,
  hideViewSwitcher = false,
  readOnly,
  crumbs,
  onNavigateCrumb,
  onSearchChange,
  onNewFolder,
  onRefresh,
  loading,
  onUploadClick,
  fileInputRef,
  onFileChange,
}: Props) {
  return (
    <div className="mb-4 flex flex-col gap-4">
      {!hideViewSwitcher ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "mine" ? "default" : "outline"}
            onClick={() => onViewModeChange("mine")}
          >
            My files
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "shared" ? "default" : "outline"}
            onClick={() => onViewModeChange("shared")}
          >
            Shared with me
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap items-center gap-0.5 text-sm">
          {crumbs.map((c, i) => (
            <span key={`${c.id ?? "root"}-${i}`} className="flex items-center gap-0.5">
              {i > 0 ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : null}
              <Button
                type="button"
                variant="link"
                className="h-auto gap-1.5 p-0 text-foreground"
                disabled={loading}
                onClick={() => onNavigateCrumb(i)}
              >
                {i === 0 ? <Home className="h-4 w-4 shrink-0" aria-hidden /> : null}
                {c.name}
              </Button>
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly ? (
            <div className="relative min-w-[12rem] max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search…" className="pl-9" onChange={onSearchChange} />
            </div>
          ) : null}
          {!readOnly ? (
            <Button type="button" variant="secondary" onClick={onNewFolder}>
              <FolderPlus className="h-4 w-4" />
              New folder
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onRefresh} disabled={loading} title="Refresh list">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          {!readOnly ? (
            <>
              <Button type="button" onClick={onUploadClick}>
                <Upload className="h-4 w-4" />
                Upload file
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
