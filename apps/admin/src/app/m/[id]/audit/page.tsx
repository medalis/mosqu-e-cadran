"use client";
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, Table, Td } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  create: "Création", update: "Modification", delete: "Suppression", submit: "Soumission", approve: "Validation", reject: "Refus", suspend: "Suspension", import: "Import", claim: "Appairage",
};
const labelAction = (a: string) => ACTION_LABEL[a] ?? ACTION_LABEL[a.split(/[._:]/).pop() ?? ""] ?? a;

export default function AuditPage() {
  const { id } = useMosque();
  const [limit, setLimit] = useState(50);
  const q = useQuery({ queryKey: ["audit", id, limit], queryFn: () => api.get<AuditLog[]>(mPath(id, "/audit-log"), { limit }), placeholderData: (prev) => prev });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Journal des modifications" description="Historique des actions effectuées sur la mosquée par les membres de l'équipe." />
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <div className="p-4"><ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div> : !q.data.length ? <div className="p-4"><Empty title="Aucune action enregistrée" /></div> : (
          <>
            <Table head={["Date", "Utilisateur", "Action", "Objet", ""]}>
              {q.data.map((l) => { const who = l.user?.fullName ?? l.user?.email ?? l.userEmail ?? l.userId ?? "Système"; const detail = l.diff ?? l.payload; return (
                <Fragment key={l.id}>
                  <tr>
                    <Td className="whitespace-nowrap text-stone-600">{fmtDateTime(l.createdAt)}</Td>
                    <Td className="text-stone-800">{who}</Td>
                    <Td><Badge tone={/delete|reject|suspend/.test(l.action) ? "danger" : /create|approve|claim/.test(l.action) ? "success" : "neutral"}>{labelAction(l.action)}</Badge></Td>
                    <Td className="text-stone-600">{l.entity ?? "—"}{l.entityId && <span className="ml-1 font-mono text-[11px] text-stone-400">{String(l.entityId).slice(0, 8)}</span>}</Td>
                    <Td className="text-right">{detail != null && <Button size="sm" variant="ghost" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Masquer" : "Détails"}</Button>}</Td>
                  </tr>
                  {open === l.id && detail != null && <tr><td colSpan={5} className="bg-stone-50 px-4 py-3"><pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-stone-700">{JSON.stringify(detail, null, 2)}</pre></td></tr>}
                </Fragment>
              ); })}
            </Table>
            {q.data.length >= limit && <div className="flex justify-center border-t border-stone-100 p-3"><Button variant="outline" size="sm" onClick={() => setLimit(limit + 50)} loading={q.isFetching}>Afficher plus</Button></div>}
          </>
        )}
      </Card>
    </>
  );
}
