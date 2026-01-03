"use client";

import useSWRInfinite from "swr/infinite";
import { useMemo, useState, useTransition } from "react";
import { jsonFetcher } from "@/lib/fetcher";
import LeadDetailDrawer from "@/components/admin/LeadDetailDrawer";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { AdminPanel } from "@/components/admin/ui/AdminPanel";
import { AdminTable, AdminTableHeader, AdminTableBody, AdminRow } from "@/components/admin/ui/AdminTable";
import { Skeleton } from "@/components/admin/ui/Skeleton";

type LeadRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  pageSlug: string;
  status: "new" | "contacted" | "booked" | "closed" | "spam";
  createdAtMs: number | null;
  statusUpdatedAtMs: number | null;
};

type LeadsResponse = { items: LeadRow[]; nextCursor?: string };

function formatDate(ms: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

export default function LeadsClient() {
  const [statusFilter, setStatusFilter] = useState("");
  const getKey = (index: number, prev: LeadsResponse | null) => {
    if (index === 0) return `/api/admin/leads?limit=50${statusFilter ? `&status=${statusFilter}` : ""}`;
    if (!prev?.nextCursor) return null;
    return `/api/admin/leads?limit=50${statusFilter ? `&status=${statusFilter}` : ""}&cursor=${prev.nextCursor}`;
  };

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<LeadsResponse>(getKey, jsonFetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const items = useMemo(() => (data ? data.flatMap((d) => d.items) : []), [data]);
  const nextCursor = data?.[data.length - 1]?.nextCursor || null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingMore, startTransition] = useTransition();

  function loadMore() {
    if (!nextCursor) return;
    startTransition(() => {
      void setSize(size + 1);
    });
  }

  function openLead(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <AdminPanel
        title="Leads"
        subtitle="Latest inbound requests with quick triage."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSize(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="booked">Booked</option>
              <option value="closed">Closed</option>
              <option value="spam">Spam</option>
            </Select>
            <Button onClick={() => mutate()} variant="secondary">
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const url = `/api/admin/leads/export${statusFilter ? `?status=${statusFilter}` : ""}`;
                window.location.href = url;
              }}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Failed to load leads. {String((error as any).message || error)}
        </div>
      )}

      <AdminTable>
        <AdminTableHeader className="grid-cols-12">
          <div className="col-span-3">Lead</div>
          <div className="col-span-2">Phone</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Page</div>
          <div className="col-span-1">Created</div>
          <div className="col-span-1 text-right">Action</div>
        </AdminTableHeader>
        <AdminTableBody>
          {(isLoading ? Array.from({ length: 8 }) : items).map((it: any, idx: number) => {
            if (!it) {
              return (
                <div key={idx} className="grid grid-cols-12 px-4 py-3">
                  <div className="col-span-3">
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="col-span-2">
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="col-span-3">
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="col-span-2">
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="col-span-1">
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="col-span-1">
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              );
            }
            return (
              <AdminRow key={it.id} onClick={() => openLead(it.id)} className="grid-cols-12">
                <div className="col-span-3">
                  <div className="font-medium text-slate-100">{it.fullName}</div>
                  <div className="text-xs text-slate-400">
                    <Badge
                      tone={
                        it.status === "new"
                          ? "warning"
                          : it.status === "spam"
                          ? "neutral"
                          : "success"
                      }
                    >
                      {it.status}
                    </Badge>
                  </div>
                </div>
                <div className="col-span-2 text-slate-100">{it.phone}</div>
                <div className="col-span-3 text-slate-100">{it.email ?? "-"}</div>
                <div className="col-span-2 text-xs text-slate-400">{it.pageSlug}</div>
                <div className="col-span-1 text-xs text-slate-400">{formatDate(it.createdAtMs)}</div>
                <div className="col-span-1 text-right">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLead(it.id);
                    }}
                  >
                    View
                  </Button>
                </div>
              </AdminRow>
            );
          })}
        </AdminTableBody>
      </AdminTable>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-400">
          Showing <span className="font-medium text-slate-100">{items.length}</span>
        </div>

        <Button variant="secondary" disabled={!nextCursor || isValidating || loadingMore} onClick={loadMore}>
          {loadingMore ? "Loading..." : nextCursor ? "Load more" : "No more leads"}
        </Button>
      </div>

      <LeadDetailDrawer
        leadId={selectedId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdated={() => mutate()}
      />
    </div>
  );
}
