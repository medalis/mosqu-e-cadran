"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, Card, Checkbox, Dialog, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Table, Td, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CONTEXT_LABEL, emptyToNull, KIND_LABEL } from "@/lib/utils";
import type { ContentItem } from "@/lib/types";

const ContentSchema = z.object({
  kind: z.enum(["hadith", "ayah", "dua", "dhikr"]),
  context: z.enum(["after_adhan", "after_prayer", "rotation"]),
  textAr: z.string().min(1, "Texte arabe requis").max(2000),
  textFr: z.string().max(2000).nullable().default(null),
  textEn: z.string().max(2000).nullable().default(null),
  reference: z.string().max(200).nullable().default(null),
  isActive: z.boolean().default(true),
});
type ContentInput = z.infer<typeof ContentSchema>;

export default function ContentPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<string>("all");
  const q = useQuery({ queryKey: ["content-items"], queryFn: () => api.get<ContentItem[]>("/super/content-items") });
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["content-items"] });
  const toggle = useMutation({ mutationFn: (c: ContentItem) => api.patch(`/super/content-items/${c.id}`, { isActive: !c.isActive }), onSuccess: refresh, onError: (e) => toast.error("Modification impossible", errorMessage(e)) });
  const del = useMutation({ mutationFn: (cid: string) => api.delete(`/super/content-items/${cid}`), onSuccess: async () => { await refresh(); toast.success("Contenu supprimé"); }, onError: (e) => toast.error("Suppression impossible", errorMessage(e)) });
  const items = (q.data ?? []).filter((c) => kind === "all" || c.kind === kind);
  return (
    <>
      <PageHeader title="Contenus" description="Hadiths, versets, invocations et adhkar diffusés sur tous les écrans (après l'adhan, après la prière, en rotation)." actions={<Button onClick={() => setEditing("new")}>+ Nouveau contenu</Button>} />
      <Card padded={false} title={`${items.length} contenu(s)`} actions={<Select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 w-40 py-0 text-xs"><option value="all">Tous les types</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}>
        {q.isPending ? <Loading /> : q.isError ? <div className="p-4"><ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div> : !items.length ? <div className="p-4"><Empty title="Aucun contenu" action={<Button onClick={() => setEditing("new")}>Ajouter</Button>} /></div> : (
          <Table head={["Type", "Texte", "Contexte", "Référence", "État", ""]}>
            {items.map((c) => (
              <tr key={c.id}>
                <Td><Badge tone="gold">{KIND_LABEL[c.kind]}</Badge></Td>
                <Td className="max-w-md"><div dir="rtl" className="line-clamp-2 text-base leading-7 text-stone-900">{c.textAr}</div>{c.textFr && <div className="line-clamp-1 text-xs text-stone-500">{c.textFr}</div>}</Td>
                <Td className="whitespace-nowrap">{CONTEXT_LABEL[c.context]}</Td>
                <Td className="text-xs text-stone-500">{c.reference ?? "—"}</Td>
                <Td><Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Actif" : "Inactif"}</Badge></Td>
                <Td className="whitespace-nowrap text-right"><Button size="sm" variant="ghost" onClick={() => toggle.mutate(c)}>{c.isActive ? "Désactiver" : "Activer"}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Modifier</Button><Button size="sm" variant="ghost" className="text-red-700" onClick={() => { if (confirm("Supprimer ce contenu ?")) del.mutate(c.id); }}>Supprimer</Button></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editing && <ContentDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ContentDialog({ item, onClose }: { item: ContentItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<ContentInput>({ resolver: zodResolver(ContentSchema), defaultValues: item ? { kind: item.kind, context: item.context, textAr: item.textAr, textFr: item.textFr, textEn: item.textEn, reference: item.reference, isActive: item.isActive } : { kind: "hadith", context: "rotation", textAr: "", textFr: null, textEn: null, reference: null, isActive: true } });
  const save = useMutation({
    mutationFn: (v: ContentInput) => (item ? api.patch(`/super/content-items/${item.id}`, v) : api.post("/super/content-items", v)),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["content-items"] }); toast.success(item ? "Contenu modifié" : "Contenu créé"); onClose(); },
    onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)),
  });
  return (
    <Dialog open onClose={onClose} title={item ? "Modifier le contenu" : "Nouveau contenu"} wide footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={handleSubmit((v) => save.mutate(v))} loading={save.isPending}>Enregistrer</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Field label="Type" error={errors.kind?.message}><Select {...register("kind")}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Contexte d'affichage" error={errors.context?.message}><Select {...register("context")}>{Object.entries(CONTEXT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Texte arabe" error={errors.textAr?.message} className="sm:col-span-2" required><Textarea dir="rtl" rows={3} className="text-lg leading-8" {...register("textAr")} /></Field>
        <Field label="Traduction française" error={errors.textFr?.message} className="sm:col-span-2"><Textarea rows={2} {...register("textFr", emptyToNull)} /></Field>
        <Field label="Traduction anglaise" error={errors.textEn?.message} className="sm:col-span-2"><Textarea rows={2} {...register("textEn", emptyToNull)} /></Field>
        <Field label="Référence" error={errors.reference?.message} hint="ex. Sahih al-Bukhari 6407 · Coran 2:152"><Input {...register("reference", emptyToNull)} /></Field>
        <div className="flex items-end pb-2"><Checkbox label="Actif" {...register("isActive")} /></div>
      </form>
    </Dialog>
  );
}
