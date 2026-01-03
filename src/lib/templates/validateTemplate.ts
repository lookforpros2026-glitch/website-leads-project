import { ALLOWED_BLOCK_TYPES, BlockNode, TemplateLayout, ThemeConfig } from "@/templates/types";

function cleanTheme(theme: any): ThemeConfig {
  const mode = theme?.mode === "dark" ? "dark" : "dark";
  const radius = theme?.radius === "2xl" ? "2xl" : "2xl";
  const container = theme?.container === "wide" ? "wide" : "normal";
  return { mode, radius, container };
}

export function sanitizeLayout(input: any): TemplateLayout | null {
  if (!input || typeof input !== "object") return null;
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const safeBlocks: BlockNode[] = blocks
    .filter((b: any) => b && typeof b === "object" && ALLOWED_BLOCK_TYPES.includes(b.type))
    .map((b: any) => ({
      id: String(b.id || `${b.type}-${Math.random().toString(36).slice(2, 8)}`),
      type: b.type,
      props: typeof b.props === "object" && b.props ? b.props : {},
      visibility: b.visibility && typeof b.visibility === "object" ? b.visibility : undefined,
    }));

  return {
    blocks: safeBlocks,
    theme: cleanTheme(input.theme),
  };
}
