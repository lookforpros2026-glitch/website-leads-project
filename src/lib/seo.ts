type TemplateVars = Record<string, string>;

export function applyTemplate(template: string, vars: TemplateVars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}
