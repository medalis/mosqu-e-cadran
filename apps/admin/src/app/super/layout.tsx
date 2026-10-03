"use client";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/auth";

export default function SuperLayout({ children }: { children: ReactNode }) {
  return <RequireAuth superOnly><Inner>{children}</Inner></RequireAuth>;
}
function Inner({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const last = typeof window !== "undefined" ? localStorage.getItem("nidaa.lastMosque") : null;
  const mosqueId = me?.memberships.find((m) => m.mosqueId === last)?.mosqueId ?? me?.memberships[0]?.mosqueId;
  return <Shell mosqueId={mosqueId}>{children}</Shell>;
}
