"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MOSQUE_STATUS, type MosqueStatus } from "@nidaa/shared";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Loading, PageHeader, Table, Tabs, Td, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { fmtDate, SERVICE_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/utils";
import type { Mosque } from "@/lib/types";

type Filter = MosqueStatus | "all";

export default function ValidationPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<Filter>("pending");
  const q = useQuery({ queryKey: ["super-mosques", status], queryFn: () => api.get<Mosque[]>("/super/mosques", status === "all" ? undefined : { status }) });
  const [rejecting, setRejecting] = useState<Mosque | null>(null);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState<Mosque | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["super-mosques"] });
  const act = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" | "suspend"; reason?: string }) => api.post<Mosque>(`/super/mosques/${v.id}/${v.action}`, v.action === "reject" ? { reason: v.reason } : undefined),
    onSuccess: async (_, v) => { await refresh(); toast.success(v.action === "approve" ? "Mosquée publiée" : v.action === "reject" ? "Mosquée refusée" : "Mosquée suspendue"); setRejecting(null); setReason(""); },
    onError: (e) => toast.error("Action impossible", errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Validation des mosquées" description="Examinez les fiches soumises avant leur publication. Une mosquée publiée apparaît dans la recherche publique et l'application." />
      <Tabs value={status} onChange={setStatus} items={[{ value: "pending", label: "En attente" }, ...MOSQUE_STATUS.filter((s) => s !== "pending").map((s) => ({ value: s, label: STATUS_LABEL[s] })), { value: "all", label: "Toutes" }]} />
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <div className="p-4"><ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div> : !q.data.length ? <div className="p-4"><Empty title="Aucune mosquée" description={status === "pending" ? "Aucune fiche n'attend de validation." : undefined} /></div> : (
          <Table head={["Mosquée", "Ville", "Statut", "Créée le", ""]}>
            {q.data.map((m) => (
              <tr key={m.id}>
                <Td><button onClick={() => setDetail(m)} className="text-left font-medium text-stone-800 hover:text-gold-700 hover:underline">{m.name}</button>{m.nameAr && <div className="text-xs text-stone-500" dir="rtl">{m.nameAr}</div>}<div className="text-xs text-stone-400">/{m.slug}</div></Td>
                <Td>{m.city}, {m.countryCode}</Td>
                <Td><Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>{m.status === "rejected" && m.rejectionReason && <div className="mt-1 max-w-xs text-xs text-stone-500">{m.rejectionReason}</div>}</Td>
                <Td className="text-stone-500">{fmtDate(m.createdAt)}</Td>
                <Td className="whitespace-nowrap text-right">
                  {m.status !== "published" && <Button size="sm" variant="secondary" onClick={() => act.mutate({ id: m.id, action: "approve" })} loading={act.isPending && act.variables?.id === m.id && act.variables.action === "approve"}>Approuver</Button>}
                  {(m.status === "pending" || m.status === "draft") && <Button size="sm" variant="ghost" className="ml-1 text-red-700" onClick={() => setRejecting(m)}>Refuser</Button>}
                  {m.status === "published" && <Button size="sm" variant="ghost" className="ml-1 text-red-700" onClick={() => { if (confirm(`Suspendre « ${m.name} » ? Elle disparaîtra du public.`)) act.mutate({ id: m.id, action: "suspend" }); }}>Suspendre</Button>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} title={`Refuser « ${rejecting?.name ?? ""} »`} footer={<><Button variant="ghost" onClick={() => setRejecting(null)}>Annuler</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={act.isPending} onClick={() => rejecting && act.mutate({ id: rejecting.id, action: "reject", reason: reason.trim() })}>Refuser</Button></>}>
        <Field label="Motif du refus" hint="Communiqué au responsable de la mosquée." required><Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. Coordonnées GPS incohérentes avec l'adresse indiquée." /></Field>
      </Dialog>

      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} wide>
        {detail && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {([["Nom arabe", detail.nameAr], ["Adresse", detail.address], ["Ville", `${detail.city}, ${detail.countryCode}`], ["Coordonnées", `${detail.latitude}, ${detail.longitude}`], ["Fuseau", detail.timezone], ["Téléphone", detail.phone], ["E-mail", detail.email], ["Site", detail.website], ["Dons", detail.donationUrl], ["Services", (detail.services ?? []).map((s) => SERVICE_LABEL[s] ?? s).join(", ")]] as Array<[string, string | null | undefined]>).map(([k, v]) => (
              <div key={k}><dt className="text-xs uppercase tracking-wide text-stone-500">{k}</dt><dd className="text-stone-800 break-words">{v || "—"}</dd></div>
            ))}
            {detail.description && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-stone-500">Description</dt><dd className="whitespace-pre-wrap text-stone-800">{detail.description}</dd></div>}
            <div className="sm:col-span-2 text-xs text-stone-500">Carte : <a className="text-teal-700 underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${detail.latitude}&mlon=${detail.longitude}#map=16/${detail.latitude}/${detail.longitude}`}>ouvrir dans OpenStreetMap ↗</a></div>
          </dl>
        )}
      </Dialog>
    </>
  );
}
