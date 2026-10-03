import type { Me } from "@nidaa/shared";

export function homeFor(me: Me): string {
  const last = typeof window !== "undefined" ? localStorage.getItem("nidaa.lastMosque") : null;
  if (last && me.memberships.some((m) => m.mosqueId === last)) return `/m/${last}`;
  if (me.memberships.length) return `/m/${me.memberships[0].mosqueId}`;
  if (me.isSuperAdmin) return "/super/validation";
  return "/onboarding";
}
export const rememberMosque = (id: string) => { if (typeof window !== "undefined") localStorage.setItem("nidaa.lastMosque", id); };
