"use client";
import { useEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { Shell } from "@/components/Shell";
import { MosqueProvider, useMosque } from "@/lib/mosque";
import { ErrorBox, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { rememberMosque } from "@/lib/nav";

export default function MosqueLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  useEffect(() => { if (id) rememberMosque(id); }, [id]);
  return (
    <RequireAuth>
      <MosqueProvider id={id}>
        <Shell mosqueId={id}><Gate>{children}</Gate></Shell>
      </MosqueProvider>
    </RequireAuth>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { query } = useMosque();
  if (query.isPending) return <Loading label="Chargement de la mosquée…" />;
  if (query.isError) return <ErrorBox message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  return <>{children}</>;
}
