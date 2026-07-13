import {
  CRM_TEMPLATE_VARIABLE_ALLOWLIST,
  type CrmTemplateVariable,
} from "@/lib/crm-v2/communications/types";

const ALLOWED_VARS = new Set<string>(CRM_TEMPLATE_VARIABLE_ALLOWLIST);

export function validateTemplateVariables(
  schema: string[],
  variables: Record<string, string>,
): { ok: true } | { ok: false; error: string } {
  for (const key of Object.keys(variables)) {
    if (!ALLOWED_VARS.has(key)) {
      return { ok: false, error: "Unsafe template variable." };
    }
    if (variables[key].length > 500) {
      return { ok: false, error: "Variable value too long." };
    }
  }
  for (const required of schema) {
    if (!ALLOWED_VARS.has(required)) {
      return { ok: false, error: "Invalid template schema." };
    }
  }
  return { ok: true };
}

export function renderTemplateBody(
  body: string,
  variables: Record<string, string>,
): { ok: true; rendered: string } | { ok: false; error: string } {
  const usedKeys = new Set<string>();
  const rendered = body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!ALLOWED_VARS.has(key)) {
      throw new Error("Unsafe template variable.");
    }
    usedKeys.add(key);
    const value = variables[key] ?? "";
    return escapeTemplateValue(value);
  });

  for (const key of usedKeys) {
    if (!ALLOWED_VARS.has(key)) {
      return { ok: false, error: "Unsafe template variable." };
    }
  }

  return { ok: true, rendered };
}

function escapeTemplateValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isAllowedTemplateVariable(key: string): key is CrmTemplateVariable {
  return ALLOWED_VARS.has(key);
}
