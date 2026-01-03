export type BlockType =
  | "hero"
  | "trust"
  | "estimator"
  | "services"
  | "faq"
  | "cta"
  | "footer";

export type BlockVisibility = {
  device?: "all" | "mobile" | "desktop";
};

export type BlockNode = {
  id: string;
  type: BlockType;
  props: Record<string, any>;
  visibility?: BlockVisibility;
};

export type ThemeConfig = {
  mode: "dark";
  radius: "2xl";
  container: "normal" | "wide";
};

export type TemplateLayout = {
  blocks: BlockNode[];
  theme: ThemeConfig;
};

export type TemplateDoc = {
  templateId: string;
  name: string;
  status: "draft" | "published";
  publishedVersion: number;
  draftVersion: number;
  draft: TemplateLayout;
  published: TemplateLayout;
};

export const ALLOWED_BLOCK_TYPES: BlockType[] = [
  "hero",
  "trust",
  "estimator",
  "services",
  "faq",
  "cta",
  "footer",
];
