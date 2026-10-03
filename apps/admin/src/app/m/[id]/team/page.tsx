"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MEMBER_ROLES, type MemberRole } from "@nidaa/shared";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Table, Td } from "@/components/ui";
import { useToast } from "@/components/toast";
import { fmtDate, ROLE_LABEL } from "@/lib/utils";
import type { Member } from "@/lib/types";

const emailOf = (m: Member) => m.email ?? m.user?.email ?? "—";
const nameOf = (m: Member) => m.fullName ?? m.user?.fullName ?? "";

export default function TeamPage() {
  const { id, invalidate } = useMosque();
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["members", id], queryFn: () => api.get<Member[]>(mPath(id, "/members")) });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("editor");
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["members", id] }); await invalidate(); };
  const invite = useMutation({ mutationFn: () => api.post<Member>(mPath(id, "/members"), { email: email.trim(), role }), onSuccess: async () => { await refresh(); toast.success("Membre ajouté"); setEmail(""); }, onError: (e) => toast.error("Ajout impossible", errorMessage(e)) });
  const change = useMutation({ mutationFn: (v: { mId: string; role: MemberRole }) => api.patch(mPath(id, `/members/${v.mId}`), { role: v.role }), onSuccess: async () => { await refresh(); toast.success("Rôle modifié"); }, onError: (e) => toast.error("Modification impossible", errorMessage(e)) });
  const remove = useMutation({ mutationFn: (mId: string) => api.delete(mPath(id, `/members/${mId}`)), onSuccess: async () => { await refresh(); toast.success("Membre retiré"); }, onError: (e) => toast.error("Suppression impossible", errorMessage(e)) });
  const myRole = me?.memberships.find((m) => m.mosqueId === id)?.role;
  const canManage = myRole === "owner" || myRole === "admin" || !!me?.isSuperAdmin;

  return (
    <>
      <PageHeader title="Équipe" description="Plusieurs responsables peuvent administrer la mosquée. L'utilisateur invité doit déjà posséder un compte Nidaa." />
      {canManage && (
        <Card title="Inviter un membre">
          <form onSubmit={(e) => { e.preventDefault(); invite.mutate(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Adresse e-mail du compte" className="flex-1" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="imam@exemple.dj" /></Field>
            <Field label="Rôle"><Select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>{MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
            <Button type="submit" disabled={!email.includes("@")} loading={invite.isPending}>Inviter</Button>
          </form>
          <p className="mt-3 text-xs text-stone-500"><strong>Propriétaire</strong> : tous les droits, dont la gestion de l'équipe · <strong>Administrateur</strong> : tout sauf la suppression de la mosquée · <strong>Éditeur</strong> : horaires, annonces et écrans.</p>
        </Card>
      )}
      <Card className="mt-6" padded={false} title="Membres">
        {q.isPending ? <Loading /> : q.isError ? <div className="p-4"><ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div> : !q.data.length ? <div className="p-4"><Empty title="Aucun membre" /></div> : (
          <Table head={["Membre", "Rôle", "Depuis", ""]}>
            {q.data.map((m) => { const isMe = emailOf(m) === me?.email || m.userId === me?.id; return (
              <tr key={m.id}>
                <Td><div className="font-medium text-stone-800">{nameOf(m) || emailOf(m)}{isMe && <Badge className="ml-2">vous</Badge>}</div>{nameOf(m) && <div className="text-xs text-stone-500">{emailOf(m)}</div>}</Td>
                <Td>{canManage && !isMe ? <Select value={m.role} onChange={(e) => change.mutate({ mId: m.id, role: e.target.value as MemberRole })} className="h-8 w-44 py-0 text-xs">{MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select> : <Badge tone={m.role === "owner" ? "gold" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>}</Td>
                <Td className="text-stone-500">{fmtDate(m.createdAt)}</Td>
                <Td className="text-right">{canManage && !isMe && <Button size="sm" variant="ghost" className="text-red-700" onClick={() => { if (confirm(`Retirer ${emailOf(m)} de l'équipe ?`)) remove.mutate(m.id); }}>Retirer</Button>}</Td>
              </tr>
            ); })}
          </Table>
        )}
      </Card>
    </>
  );
}
