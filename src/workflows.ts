import { invoke } from "@tauri-apps/api/core";

export type WorkflowArg = {
  name: string;
  description?: string | null;
  default_value?: string | null;
};

export type Workflow = {
  name: string;
  command: string;
  description?: string | null;
  tags: string[];
  arguments: WorkflowArg[];
  source: string;
};

export function listWorkflows(): Promise<Workflow[]> {
  return invoke<Workflow[]>("list_workflows");
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

/** Replace `{{name}}` placeholders with provided values. Unfilled placeholders
 *  are left intact so the preview shows what's still missing. */
export function fillCommand(
  command: string,
  values: Record<string, string>
): string {
  return command.replace(PLACEHOLDER, (whole, name) => {
    const v = values[name];
    return v !== undefined && v !== "" ? v : whole;
  });
}

/** Placeholder names in order of first appearance. */
export function placeholderNames(command: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  PLACEHOLDER.lastIndex = 0;
  while ((m = PLACEHOLDER.exec(command))) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Merge declared arguments with any bare placeholders found in the command
 *  (so a workflow that uses `{{x}}` without declaring it still gets a field). */
export function effectiveArgs(wf: Workflow): WorkflowArg[] {
  const declared = new Map(wf.arguments.map((a) => [a.name, a]));
  const out: WorkflowArg[] = [];
  for (const name of placeholderNames(wf.command)) {
    out.push(declared.get(name) ?? { name, default_value: "" });
  }
  // Keep declared args that don't appear in the command too (rare, but honour
  // the file).
  for (const a of wf.arguments) {
    if (!out.some((o) => o.name === a.name)) out.push(a);
  }
  return out;
}
