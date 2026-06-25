import { invoke } from "@tauri-apps/api/core";

export type ShellSetupHint = {
  shell: string;
  scriptPath: string;
  sourceLine: string;
  rcFile: string;
};

export function getShellSetupHint(): Promise<ShellSetupHint> {
  return invoke<ShellSetupHint>("get_shell_setup_hint");
}
