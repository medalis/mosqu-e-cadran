"use client";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { ErrorBox, Loading, PageHeader, Stat } from "@/components/ui";
import type { SuperStats } from "@/lib/types";

export default function StatsPage() {
  const q = useQuery({ queryKey: ["super-stats"], queryFn: () => api.get<SuperStats>("/super/stats"), refetchInterval: 60_000 });
  return (
    <>
      <PageHeader title="Statistiques de la plateforme" description="Vue d'ensemble, actualisée chaque minute." />
      {q.isPending ? <Loading /> : q.isError ? <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Mosquées inscrites" value={q.data.mosques} />
          <Stat label="Mosquées publiées" value={q.data.published} tone="gold" hint={q.data.mosques ? `${Math.round((q.data.published / q.data.mosques) * 100)} % du total` : undefined} />
          <Stat label="Écrans en ligne" value={q.data.screensOnline} tone="teal" />
          <Stat label="Utilisateurs" value={q.data.users} />
        </div>
      )}
    </>
  );
}
