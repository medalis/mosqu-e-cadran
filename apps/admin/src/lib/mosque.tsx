"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { api } from "./api";
import type { MosqueDetail } from "./types";

interface Ctx { id: string; query: UseQueryResult<MosqueDetail>; mosque: MosqueDetail | undefined; invalidate: () => Promise<void> }
const MosqueCtx = createContext<Ctx | null>(null);

export const mosqueKey = (id: string) => ["mosque", id] as const;

export function MosqueProvider({ id, children }: { id: string; children: ReactNode }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: mosqueKey(id), queryFn: () => api.get<MosqueDetail>(`/admin/mosques/${id}`), enabled: !!id });
  const invalidate = async () => { await qc.invalidateQueries({ queryKey: mosqueKey(id) }); await qc.invalidateQueries({ queryKey: ["me"] }); };
  return <MosqueCtx.Provider value={{ id, query, mosque: query.data, invalidate }}>{children}</MosqueCtx.Provider>;
}

export function useMosque() {
  const ctx = useContext(MosqueCtx);
  if (!ctx) throw new Error("useMosque hors MosqueProvider");
  return ctx;
}

export const mPath = (id: string, sub = "") => `/admin/mosques/${id}${sub}`;
