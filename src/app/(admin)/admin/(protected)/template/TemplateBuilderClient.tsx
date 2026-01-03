"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { renderTemplate } from "@/templates/renderTemplate";
import type { BlockNode, BlockType, TemplateLayout } from "@/templates/types";
import { buildDefaultTemplateLayout } from "@/templates/defaultTemplate";

type TemplateResponse = {
  ok: boolean;
  template?: {
    draft: TemplateLayout;
    published: TemplateLayout;
    draftVersion: number;
    publishedVersion: number;
    status: "draft" | "published";
  };
};

const BLOCK_LIBRARY: Array<{ type: BlockType; label: string }> = [
  { type: "hero", label: "Hero" },
  { type: "trust", label: "Trust" },
  { type: "estimator", label: "Estimator" },
  { type: "services", label: "Services" },
  { type: "faq", label: "FAQ" },
  { type: "cta", label: "CTA" },
  { type: "footer", label: "Footer" },
];

const defaultPropsByType: Record<BlockType, Record<string, any>> = {
  hero: {
    headlineTemplate: "{service} in {place}",
    subheadline: "Answer a few questions. Get an instant rough estimate. Get matched with pros.",
    ctaText: "Get instant estimate",
    ctaSecondaryText: "Talk to a specialist",
  },
  trust: {
    sectionTitle: "Why homeowners choose us",
    stepsTitle: "How it works",
    testimonialsTitle: "Homeowner stories",
  },
  estimator: {
    title: "Instant estimate",
    subtitle: "Answer a few questions to get a fast, credible range.",
  },
  services: {
    scopeTitle: "{service} scope (typical)",
    pricingTitle: "Pricing guidance",
    serviceAreaTitle: "Serving {city} and nearby",
  },
  faq: {
    title: "FAQ",
  },
  cta: {
    title: "Get your estimate in 60 seconds",
    subtitle: "Quick, no-pressure estimate for {service} in {city}.",
    buttonText: "Get instant estimate",
  },
  footer: {
    disclaimer: "Fast estimates and professional service.",
  },
};

function createBlock(type: BlockType): BlockNode {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    props: { ...defaultPropsByType[type] },
  };
}

function LibraryItem({ type, label }: { type: BlockType; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `library-${type}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-xl border border-slate-800 px-3 py-2 text-xs text-slate-200 ${
        isDragging ? "bg-slate-800/40" : "bg-slate-950"
      }`}
    >
      {label}
    </div>
  );
}

function SortableBlockItem({
  block,
  selected,
  onSelect,
  onDelete,
}: {
  block: BlockNode;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border px-3 py-3 text-sm ${
        selected ? "border-emerald-400/60 bg-emerald-400/5" : "border-slate-800 bg-slate-950"
      } ${isDragging ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button className="text-left flex-1" onClick={onSelect}>
          <div className="text-xs uppercase text-slate-500">Block</div>
          <div className="font-semibold text-slate-100">{block.type}</div>
        </button>
        <div className="flex items-center gap-2">
          <button className="h-8 w-8 rounded-lg border border-slate-800 text-xs text-slate-300" onClick={onDelete}>
            Del
          </button>
          <button className="h-8 w-8 rounded-lg border border-slate-800 text-xs text-slate-300" {...listeners} {...attributes}>
            Drag
          </button>
        </div>
      </div>
    </div>
  );
}

function CanvasDropZone({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-0 overflow-hidden rounded-2xl border border-dashed bg-slate-950/30 px-3 py-3 ${
        isOver ? "border-emerald-400/60 bg-emerald-400/5" : "border-slate-800"
      }`}
    >
      {children}
    </div>
  );
}

export default function TemplateBuilderClient() {
  const [layout, setLayout] = useState<TemplateLayout>(buildDefaultTemplateLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [dragLabel, setDragLabel] = useState<string | null>(null);

  const selectedBlock = useMemo(
    () => layout.blocks.find((b) => b.id === selectedId) || null,
    [layout.blocks, selectedId]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/templates/get");
      const json = (await res.json().catch(() => ({}))) as TemplateResponse;
      if (!active) return;
      if (json.ok && json.template) {
        setLayout(json.template.draft || buildDefaultTemplateLayout());
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/templates/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: "default", draft: layout }),
      });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? "Draft saved." : json?.error || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [layout]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/templates/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: "default" }),
      });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? "Template published." : json?.error || "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }, []);

  const updateBlockProps = useCallback((id: string, patch: Record<string, any>) => {
    setLayout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b)),
    }));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setLayout((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      if (activeId.startsWith("library-")) {
        const type = activeId.replace("library-", "") as BlockType;
        const newBlock = createBlock(type);
        setLayout((prev) => {
          const next = [...prev.blocks];
          const overIndex = prev.blocks.findIndex((b) => b.id === String(over.id));
          if (overIndex >= 0) next.splice(overIndex, 0, newBlock);
          else next.push(newBlock);
          return { ...prev, blocks: next };
        });
        setSelectedId(newBlock.id);
        setDragLabel(null);
        return;
      }

      if (activeId === over.id) return;
      setLayout((prev) => {
        const oldIndex = prev.blocks.findIndex((b) => b.id === activeId);
        const newIndex = prev.blocks.findIndex((b) => b.id === String(over.id));
        if (oldIndex < 0 || newIndex < 0) return prev;
        return { ...prev, blocks: arrayMove(prev.blocks, oldIndex, newIndex) };
      });
    },
    []
  );

  const samplePage = useMemo(
    () => ({
      slugPath: "/los-angeles/91306/n/winnetka/roof-repair",
      zip: "91306",
      county: { name: "Los Angeles County", slug: "los-angeles" },
      city: { name: "Los Angeles", slug: "los-angeles" },
      service: { name: "Roof Repair", slug: "roof-repair" },
      locationLabel: "Winnetka",
      content: {},
    }),
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Template Builder</h1>
          <p className="text-xs text-slate-400">Drag blocks, edit props, save draft, publish.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={previewMode} onChange={(e) => setPreviewMode(e.target.value as any)}>
            <option value="desktop">Preview: Desktop</option>
            <option value="mobile">Preview: Mobile</option>
          </Select>
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save draft"}
          </Button>
          <Button variant="primary" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {message && <div className="text-xs text-slate-300">{message}</div>}
      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-300">Loading template...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Blocks</div>
            {BLOCK_LIBRARY.map((b) => (
              <LibraryItem key={b.type} type={b.type} label={b.label} />
            ))}
          </section>

          <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Canvas</div>
            <DndContext
              onDragStart={(event) => {
                const id = String(event.active.id);
                if (id.startsWith("library-")) {
                  const type = id.replace("library-", "");
                  setDragLabel(type);
                } else {
                  const block = layout.blocks.find((b) => b.id === id);
                  setDragLabel(block?.type || null);
                }
              }}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDragLabel(null)}
            >
              <CanvasDropZone>
                <SortableContext items={layout.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {layout.blocks.map((block) => (
                      <SortableBlockItem
                        key={block.id}
                        block={block}
                        selected={selectedId === block.id}
                        onSelect={() => setSelectedId(block.id)}
                        onDelete={() => deleteBlock(block.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </CanvasDropZone>
              <DragOverlay>
                {dragLabel ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100">
                    {dragLabel}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </section>

          <section className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Inspector</div>
            {!selectedBlock ? (
              <div className="mt-3 text-xs text-slate-400">Select a block to edit its settings.</div>
            ) : (
              <div className="mt-3 space-y-3 text-xs text-slate-300">
                <div className="text-sm font-semibold text-slate-100">{selectedBlock.type}</div>
                {selectedBlock.type === "hero" && (
                  <>
                    <Input
                      value={selectedBlock.props?.headlineTemplate || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { headlineTemplate: e.target.value })}
                      placeholder="Headline template"
                    />
                    <Input
                      value={selectedBlock.props?.subheadline || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { subheadline: e.target.value })}
                      placeholder="Subheadline"
                    />
                    <Input
                      value={selectedBlock.props?.ctaText || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { ctaText: e.target.value })}
                      placeholder="Primary CTA"
                    />
                    <Input
                      value={selectedBlock.props?.ctaSecondaryText || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { ctaSecondaryText: e.target.value })}
                      placeholder="Secondary CTA"
                    />
                  </>
                )}
                {selectedBlock.type === "trust" && (
                  <>
                    <Input
                      value={selectedBlock.props?.stepsTitle || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { stepsTitle: e.target.value })}
                      placeholder="Steps title"
                    />
                    <Input
                      value={selectedBlock.props?.sectionTitle || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { sectionTitle: e.target.value })}
                      placeholder="Trust title"
                    />
                    <Input
                      value={selectedBlock.props?.testimonialsTitle || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { testimonialsTitle: e.target.value })}
                      placeholder="Testimonials title"
                    />
                  </>
                )}
                {selectedBlock.type === "estimator" && (
                  <>
                    <Input
                      value={selectedBlock.props?.title || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { title: e.target.value })}
                      placeholder="Title"
                    />
                    <Input
                      value={selectedBlock.props?.subtitle || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { subtitle: e.target.value })}
                      placeholder="Subtitle"
                    />
                  </>
                )}
                {selectedBlock.type === "services" && (
                  <>
                    <Input
                      value={selectedBlock.props?.scopeTitle || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { scopeTitle: e.target.value })}
                      placeholder="Scope title"
                    />
                    <Input
                      value={selectedBlock.props?.pricingTitle || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { pricingTitle: e.target.value })}
                      placeholder="Pricing title"
                    />
                    <Input
                      value={selectedBlock.props?.serviceAreaTitle || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { serviceAreaTitle: e.target.value })}
                      placeholder="Service area title"
                    />
                  </>
                )}
                {selectedBlock.type === "faq" && (
                  <Input
                    value={selectedBlock.props?.title || ""}
                    onChange={(e) => updateBlockProps(selectedBlock.id, { title: e.target.value })}
                    placeholder="FAQ title"
                  />
                )}
                {selectedBlock.type === "cta" && (
                  <>
                    <Input
                      value={selectedBlock.props?.title || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { title: e.target.value })}
                      placeholder="CTA title"
                    />
                    <Input
                      value={selectedBlock.props?.subtitle || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { subtitle: e.target.value })}
                      placeholder="CTA subtitle"
                    />
                    <Input
                      value={selectedBlock.props?.buttonText || ""}
                      onChange={(e) => updateBlockProps(selectedBlock.id, { buttonText: e.target.value })}
                      placeholder="CTA button text"
                    />
                  </>
                )}
                {selectedBlock.type === "footer" && (
                  <Input
                    value={selectedBlock.props?.disclaimer || ""}
                    onChange={(e) => updateBlockProps(selectedBlock.id, { disclaimer: e.target.value })}
                    placeholder="Footer disclaimer"
                  />
                )}
              </div>
            )}
          </section>

          <section className="lg:col-span-12 rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Preview</div>
            <div
              className={`mx-auto w-full rounded-2xl border border-slate-800 bg-white ${
                previewMode === "mobile" ? "max-w-[420px]" : "max-w-[1100px]"
              }`}
            >
              {renderTemplate(layout, samplePage as any, "builder")}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
