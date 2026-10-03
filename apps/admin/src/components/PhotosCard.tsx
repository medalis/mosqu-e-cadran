"use client";
import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { Button, Card, ErrorBox, Loading, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import { IMAGE_RULES, imageProblem, type Media } from "@/lib/types";

/** Photos de la fiche mosquée : envoi (bouton ou glisser-déposer), vignettes, ordre, suppression. La première est la photo principale. */
export function PhotosCard() {
  const { id } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["media", id, "photo"] as const;
  const q = useQuery({ queryKey: key, queryFn: () => api.get<Media[]>(mPath(id, "/media"), { kind: "photo" }) });
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const photos = q.data ?? [];
  const full = photos.length >= IMAGE_RULES.maxPhotos;
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function addFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const problems: string[] = [];
    const room = Math.max(0, IMAGE_RULES.maxPhotos - photos.length);
    const valid = files.filter((f) => { const p = imageProblem(f); if (p) problems.push(p); return !p; });
    if (valid.length > room) problems.push(room === 0 ? `Limite atteinte : ${IMAGE_RULES.maxPhotos} photos au maximum. Supprimez-en une avant d'en ajouter.` : `Seules ${room} photo${room > 1 ? "s" : ""} sur ${valid.length} ont été envoyées : la limite est de ${IMAGE_RULES.maxPhotos} photos par mosquée.`);
    const toSend = valid.slice(0, room);
    setErrors(problems);
    if (!toSend.length) return;
    setBusy(toSend.length);
    let sent = 0;
    // Un fichier à la fois : l'ordre d'affichage suit l'ordre de sélection.
    for (const file of toSend) {
      try { await api.upload<Media>(mPath(id, "/media"), { kind: "photo", file }); sent++; }
      catch (e) { problems.push(`« ${file.name} » : ${errorMessage(e)}`); setErrors([...problems]); }
      setBusy((n) => n - 1);
    }
    setBusy(0);
    await refresh();
    if (sent) toast.success(sent > 1 ? `${sent} photos ajoutées` : "Photo ajoutée");
  }

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.patch<Media[]>(mPath(id, "/media/order"), { ids }),
    onMutate: (ids) => { qc.setQueryData<Media[]>(key, (old) => ids.map((x) => old?.find((m) => m.id === x)).filter((m): m is Media => !!m)); },
    onError: (e) => toast.error("Réorganisation impossible", errorMessage(e)),
    onSettled: refresh,
  });
  const del = useMutation({
    mutationFn: (mediaId: string) => api.delete(mPath(id, `/media/${mediaId}`)),
    onSuccess: async () => { await refresh(); toast.success("Photo supprimée"); },
    onError: (e) => toast.error("Suppression impossible", errorMessage(e)),
  });
  const move = (i: number, delta: -1 | 1) => {
    const ids = photos.map((p) => p.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); };

  return (
    <Card className="mt-6" title="Photos" description={`Affichées sur la page publique de la mosquée. La première est la photo principale. ${photos.length} / ${IMAGE_RULES.maxPhotos}.`}
      actions={<Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={full || busy > 0}>+ Ajouter des photos</Button>}>
      <input ref={inputRef} type="file" accept={IMAGE_RULES.accept} multiple className="hidden" data-testid="photo-input" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      {q.isPending ? <Loading /> : q.isError ? <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn("rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition", dragging ? "border-gold-500 bg-gold-50 text-gold-700" : "border-stone-300 text-stone-500", full && "opacity-60")}
          >
            {busy > 0 ? <span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" /> Envoi en cours… ({busy} restante{busy > 1 ? "s" : ""})</span>
              : full ? <>Limite de {IMAGE_RULES.maxPhotos} photos atteinte. Supprimez une photo pour en ajouter une autre.</>
              : <>Glissez vos photos ici ou <button type="button" className="font-medium text-gold-700 underline" onClick={() => inputRef.current?.click()}>choisissez des fichiers</button>.<br /><span className="text-xs">JPEG, PNG ou WebP · 5 Mo au maximum par photo · {IMAGE_RULES.maxPhotos} photos au maximum</span></>}
          </div>

          {errors.length > 0 && (
            <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <ul className="space-y-1">{errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
              <button type="button" className="mt-2 text-xs underline" onClick={() => setErrors([])}>Fermer</button>
            </div>
          )}

          {photos.length > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="photo-grid">
              {photos.map((p, i) => (
                <li key={p.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <div className="relative aspect-[4/3] bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-gold-600 px-2 py-0.5 text-[11px] font-medium text-white">Photo principale</span>}
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="px-2" aria-label={`Déplacer la photo ${i + 1} vers la gauche`} title="Déplacer vers la gauche" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>←</Button>
                      <Button size="sm" variant="ghost" className="px-2" aria-label={`Déplacer la photo ${i + 1} vers la droite`} title="Déplacer vers la droite" disabled={i === photos.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>→</Button>
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Supprimer la photo ${i + 1}`} disabled={del.isPending} onClick={() => { if (confirm("Supprimer cette photo ?")) del.mutate(p.id); }}>Supprimer</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
