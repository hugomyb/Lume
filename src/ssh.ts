import { invoke } from "@tauri-apps/api/core";

export type SshHost = {
  name: string;
  hostName?: string | null;
  user?: string | null;
  port?: string | null;
};

export function listSshHosts(): Promise<SshHost[]> {
  return invoke<SshHost[]>("list_ssh_hosts");
}

/** Human-readable target line, e.g. `deploy@10.0.0.1:2222`. */
export function hostTarget(h: SshHost): string {
  const base = h.hostName ?? h.name;
  const withUser = h.user ? `${h.user}@${base}` : base;
  return h.port ? `${withUser}:${h.port}` : withUser;
}

/** The shell command that connects to a host alias (or a raw target). ssh
 *  resolves HostName/User/Port from ~/.ssh/config when given the alias. */
export function sshCommand(target: string): string {
  return `ssh ${target}`;
}
