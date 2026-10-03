"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnnouncementInputSchema, type AnnouncementInput } from "@nidaa/shared";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, Card, Checkbox, Dialog, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Table, Td, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { emptyToNull, fmtDateTime, fromLocalInput, toLocalInput } from "@/lib/utils";
import { IMAGE_RULES, imageProblem, type Announcement, type FlashMessage, type Media } from "@/lib/types";

const TYPE_LABEL = { text: "Texte", image: "Image", video: "Vidéo" } as const;
const TARGET_LABEL = { screen: "Écran", web: "Web", app: "Application" } as const;

export default function AnnouncementsPage() {
  const { id } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["announcements", id], queryFn: () => api.get<Announcement[]>(mPath(id, "/announcements")) });
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["announcements", id] });
  const toggle = useMutation({ mutationFn: (a: Announcement) => api.patch(mPath(id, `/announcements/${a.id}`), { isActive: !a.isActive }), onSuccess: refresh, onError: (e) => toast.error("Modification impossible", errorMessage(e)) });
  const del = useMutation({ mutationFn: (aId: string) => api.delete(mPath(id, `/announcements/${aId}`)), onSuccess: async () => { await refresh(); toast.success("Annonce supprimée"); }, onError: (e) => toast.error("Suppression impossible", errorMessage(e)) });
  const now = Date.now();
  const stateOf = (a: Announcement) => !a.isActive ? { label: "Désactivée", tone: "neutral" as const } : a.startsAt && new Date(a.startsAt).getTime() > now ? { label: "Programmée", tone: "info" as const } : a.endsAt && new Date(a.endsAt).getTime() < now ? { label: "Expirée", tone: "warning" as const } : { label: "Active", tone: "success" as const };

  return (
    <>
      <PageHeader title="Annonces" description="Messages diffusés sur l'écran de la salle, la page publique et l'application." actions={<Button onClick={() => setEditing("new")}>+ Nouvelle annonce</Button>} />
      <FlashCard />
      <Card className="mt-6" padded={false} title="Annonces">
        {q.isPending ? <Loading /> : q.isError ? <div className="p-4"><ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div> : !q.data.length ? <div className="p-4"><Empty title="Aucune annonce" description="Créez une annonce texte, image ou vidéo avec une période de diffusion." action={<Button onClick={() => setEditing("new")}>Créer une annonce</Button>} /></div> : (
          <Table head={["Titre", "Type", "Diffusion", "Cibles", "État", ""]}>
            {q.data.map((a) => { const st = stateOf(a); return (
              <tr key={a.id}>
                <Td><div className="font-medium text-stone-800">{a.title}</div>{a.body && <div className="line-clamp-1 max-w-xs text-xs text-stone-500">{a.body}</div>}</Td>
                <Td>{TYPE_LABEL[a.type]}</Td>
                <Td className="whitespace-nowrap text-xs text-stone-600">{a.startsAt || a.endsAt ? <>{a.startsAt ? fmtDateTime(a.startsAt) : "…"} → {a.endsAt ? fmtDateTime(a.endsAt) : "…"}</> : "Permanente"}<div className="text-stone-400">{a.durationSec} s à l'écran</div></Td>
                <Td><div className="flex flex-wrap gap-1">{a.targets.map((t) => <Badge key={t}>{TARGET_LABEL[t]}</Badge>)}</div></Td>
                <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                <Td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(a)}>{a.isActive ? "Désactiver" : "Activer"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Modifier</Button>
                  <Button size="sm" variant="ghost" className="text-red-700" onClick={() => { if (confirm(`Supprimer « ${a.title} » ?`)) del.mutate(a.id); }}>Supprimer</Button>
                </Td>
              </tr>
            ); })}
          </Table>
        )}
      </Card>
      {editing && <AnnouncementDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function FlashCard() {
  const { id } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["flash", id], queryFn: () => api.get<FlashMessage | null>(mPath(id, "/flash-message")) });
  const [text, setText] = useState("");
  const [isActive, setIsActive] = useState(false);
  useEffect(() => { if (q.data !== undefined) { setText(q.data?.text ?? ""); setIsActive(q.data?.isActive ?? false); } }, [q.data]);
  const save = useMutation({ mutationFn: () => api.put(mPath(id, "/flash-message"), { text, isActive }), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["flash", id] }); toast.success("Message flash enregistré"); }, onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)) });
  return (
    <Card title="Message flash" description="Bandeau défilant en bas de l'écran entre les prières (ex. collecte, horaire exceptionnel).">
      {q.isPending ? <Loading /> : q.isError ? <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Texte" className="flex-1"><Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Message court et lisible de loin…" /></Field>
          <Checkbox label="Afficher sur l'écran" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="mb-2.5" />
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={isActive && !text.trim()}>Enregistrer</Button>
        </div>
      )}
    </Card>
  );
}

function AnnouncementDialog({ item, onClose }: { item: Announcement | null; onClose: () => void }) {
  const { id } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<AnnouncementInput>({
    resolver: zodResolver(AnnouncementInputSchema),
    defaultValues: item ? { type: item.type, title: item.title, body: item.body, mediaUrl: item.mediaUrl, startsAt: item.startsAt, endsAt: item.endsAt, durationSec: item.durationSec, targets: item.targets, isActive: item.isActive } : AnnouncementInputSchema.parse({ title: "" }),
  });
  const type = useWatch({ control, name: "type" });
  const mediaUrl = useWatch({ control, name: "mediaUrl" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => api.upload<Media>(mPath(id, "/media"), { kind: "announcement_image", file }),
    onSuccess: (m) => { setValue("mediaUrl", m.url, { shouldDirty: true, shouldValidate: true }); setUploadError(null); },
    onError: (e) => setUploadError(errorMessage(e)),
  });
  const pickImage = (file: File | undefined) => {
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) { setUploadError(problem); return; }
    setUploadError(null);
    upload.mutate(file);
  };
  const save = useMutation({
    mutationFn: (v: AnnouncementInput) => (item ? api.patch(mPath(id, `/announcements/${item.id}`), v) : api.post(mPath(id, "/announcements"), v)),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["announcements", id] }); toast.success(item ? "Annonce modifiée" : "Annonce créée"); onClose(); },
    onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)),
  });
  const dt = { setValueAs: (v: string) => fromLocalInput(v) };
  return (
    <Dialog open onClose={onClose} title={item ? "Modifier l'annonce" : "Nouvelle annonce"} wide footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={handleSubmit((v) => save.mutate(v))} loading={save.isPending}>Enregistrer</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Field label="Type" error={errors.type?.message}><Select {...register("type")}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Titre" error={errors.title?.message} required><Input {...register("title")} /></Field>
        <Field label="Texte" error={errors.body?.message} className="sm:col-span-2"><Textarea rows={4} {...register("body", emptyToNull)} /></Field>
        {type === "image" && (
          <div className="sm:col-span-2 space-y-2">
            <span className="block text-sm font-medium text-stone-700">Image de l'annonce</span>
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {mediaUrl && <img src={mediaUrl} alt="Aperçu de l'image de l'annonce" className="h-20 w-32 rounded-md border border-stone-200 bg-stone-100 object-contain" />}
              <input ref={fileRef} type="file" accept={IMAGE_RULES.accept} className="hidden" data-testid="announcement-image-input" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
              <Button type="button" variant="outline" size="sm" loading={upload.isPending} onClick={() => fileRef.current?.click()}>{mediaUrl ? "Remplacer l'image" : "Choisir une image…"}</Button>
              {mediaUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setValue("mediaUrl", null, { shouldDirty: true })}>Retirer</Button>}
              <span className="text-xs text-stone-500">JPEG, PNG ou WebP · 5 Mo au maximum</span>
            </div>
            {uploadError && <p role="alert" className="text-xs text-red-600">{uploadError}</p>}
          </div>
        )}
        {type !== "text" && <Field label={type === "image" ? "…ou URL de l'image" : "URL de la vidéo"} error={errors.mediaUrl?.message} className="sm:col-span-2" hint="Lien direct (https://…)."><Input type="url" {...register("mediaUrl", emptyToNull)} /></Field>}
        <Field label="Début de diffusion" error={errors.startsAt?.message} hint="Vide = immédiat."><Input type="datetime-local" defaultValue={toLocalInput(item?.startsAt)} {...register("startsAt", dt)} /></Field>
        <Field label="Fin de diffusion" error={errors.endsAt?.message} hint="Vide = sans limite."><Input type="datetime-local" defaultValue={toLocalInput(item?.endsAt)} {...register("endsAt", dt)} /></Field>
        <Field label="Durée d'affichage à l'écran (s)" error={errors.durationSec?.message}><Input type="number" min={3} max={120} {...register("durationSec", { valueAsNumber: true })} /></Field>
        <Field label="Cibles" error={errors.targets?.message}><div className="flex flex-wrap gap-4 pt-2">{Object.entries(TARGET_LABEL).map(([k, v]) => <Checkbox key={k} value={k} label={v} {...register("targets")} />)}</div></Field>
        <div className="sm:col-span-2"><Checkbox label="Annonce active" {...register("isActive")} /></div>
      </form>
    </Dialog>
  );
}
