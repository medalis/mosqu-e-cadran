"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PRAYERS, SCREEN_THEMES, ScreenSettingsSchema, type ScreenSettings } from "@nidaa/shared";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, Card, Checkbox, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Table, Td } from "@/components/ui";
import { useToast } from "@/components/toast";
import { asNumber, cn, fmtDateTime, isOnline, PRAYER_FR, relativeTime, THEME_SWATCH } from "@/lib/utils";
import type { ScreenDevice } from "@/lib/types";

const SCREEN_URL = (process.env.NEXT_PUBLIC_SCREEN_URL ?? "http://localhost:5173").replace(/\/$/, "");

export default function ScreensPage() {
  const { mosque } = useMosque();
  if (!mosque) return null;
  const previewUrl = `${SCREEN_URL}/?preview=${encodeURIComponent(mosque.slug)}`;
  return (
    <>
      <PageHeader title="Écrans" description="Appairez les écrans de la salle de prière et réglez leur apparence." actions={<a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-md border border-teal-300 bg-teal-50 px-4 text-sm font-medium text-teal-800 hover:bg-teal-100">Prévisualiser l'écran ↗</a>} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2"><ClaimCard /><DevicesCard /></div>
        <div className="lg:col-span-3"><SettingsCard /></div>
      </div>
    </>
  );
}

function ClaimCard() {
  const { id } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const claim = useMutation({
    mutationFn: () => api.post<ScreenDevice>(mPath(id, "/screens/claim"), { code: code.trim().toUpperCase(), name: name.trim() || undefined }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["screens", id] }); toast.success("Écran appairé", "L'écran va se synchroniser dans quelques secondes."); setCode(""); setName(""); },
    onError: (e) => toast.error("Appairage impossible", errorMessage(e)),
  });
  return (
    <Card title="Appairer un écran" description="Lancez l'application Nidaa Écran sur la TV : un code à 6 caractères s'affiche. Saisissez-le ici (valable 10 minutes).">
      <form onSubmit={(e) => { e.preventDefault(); claim.mutate(); }} className="space-y-3">
        <Field label="Code d'appairage" required><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="ABC123" className="text-center font-mono text-lg uppercase tracking-[0.4em]" maxLength={6} autoComplete="off" /></Field>
        <Field label="Nom de l'écran" hint="ex. Salle principale, Salle des femmes"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Button type="submit" className="w-full" disabled={code.length !== 6} loading={claim.isPending}>Appairer</Button>
      </form>
    </Card>
  );
}

function DevicesCard() {
  const { id } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["screens", id], queryFn: () => api.get<ScreenDevice[]>(mPath(id, "/screens")), refetchInterval: 30_000 });
  const del = useMutation({ mutationFn: (sid: string) => api.delete(mPath(id, `/screens/${sid}`)), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["screens", id] }); toast.success("Écran retiré"); }, onError: (e) => toast.error("Suppression impossible", errorMessage(e)) });
  return (
    <Card title="Écrans appairés" padded={false} actions={<Button size="sm" variant="ghost" onClick={() => q.refetch()}>Actualiser</Button>}>
      {q.isPending ? <Loading /> : q.isError ? <div className="p-4"><ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div> : !q.data.length ? <div className="p-4"><Empty title="Aucun écran appairé" /></div> : (
        <ul className="divide-y divide-stone-100">
          {q.data.map((s) => { const on = isOnline(s.lastSeenAt); const drift = s.clockDriftMs ?? 0; return (
            <li key={s.id} className="flex items-start justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", on ? "bg-teal-500" : "bg-stone-300")} /><span className="truncate font-medium text-stone-800">{s.name ?? "Écran"}</span><Badge tone={on ? "success" : "neutral"}>{on ? "En ligne" : "Hors ligne"}</Badge></div>
                <dl className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-stone-500">
                  <dt>Dernier contact</dt><dd title={fmtDateTime(s.lastSeenAt)}>{relativeTime(s.lastSeenAt)}</dd>
                  <dt>Version appli</dt><dd>{s.appVersion ?? "—"}</dd>
                  <dt>Version du bundle</dt><dd>{s.bundleVersion ?? "—"}</dd>
                  <dt>Dérive d'horloge</dt><dd className={cn(Math.abs(drift) > 30_000 && "font-medium text-red-600")}>{s.clockDriftMs == null ? "—" : `${drift > 0 ? "+" : ""}${(drift / 1000).toFixed(1)} s`}</dd>
                </dl>
              </div>
              <Button size="sm" variant="ghost" className="text-red-700" onClick={() => { if (confirm(`Retirer l'écran « ${s.name ?? "Écran"} » ? Il devra être appairé à nouveau.`)) del.mutate(s.id); }}>Retirer</Button>
            </li>
          ); })}
        </ul>
      )}
    </Card>
  );
}

function SettingsCard() {
  const { id, mosque, invalidate } = useMosque();
  const toast = useToast();
  const initial = useMemo(() => ScreenSettingsSchema.parse(mosque?.screenSettings ?? {}), [mosque?.screenSettings]);
  const { register, handleSubmit, control, setValue, reset, formState: { errors, isDirty } } = useForm<ScreenSettings>({ resolver: zodResolver(ScreenSettingsSchema), defaultValues: initial });
  const theme = useWatch({ control, name: "theme" });
  const save = useMutation({
    mutationFn: (v: ScreenSettings) => api.put<ScreenSettings>(mPath(id, "/screen-settings"), v),
    onSuccess: async (s) => { await invalidate(); reset(ScreenSettingsSchema.parse(s)); toast.success("Paramètres de l'écran enregistrés", "Les écrans se mettent à jour en moins d'une minute."); },
    onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)),
  });
  return (
    <Card title="Paramètres d'affichage" description="Appliqués à tous les écrans de la mosquée.">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6" noValidate>
        <Field label="Thème" error={errors.theme?.message}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SCREEN_THEMES.map((t) => { const sw = THEME_SWATCH[t]; return (
              <button type="button" key={t} onClick={() => setValue("theme", t, { shouldDirty: true })} className={cn("rounded-lg border-2 p-1 text-left transition", theme === t ? "border-gold-500" : "border-transparent hover:border-stone-300")} aria-pressed={theme === t}>
                <div className="flex h-14 flex-col justify-between rounded-md p-2" style={{ background: sw.bg, color: sw.fg }}>
                  <div className="text-[10px] font-semibold tabular-nums">05:12</div>
                  <div className="h-1.5 w-2/3 rounded" style={{ background: sw.accent }} />
                </div>
                <div className="mt-1 px-1 text-xs font-medium text-stone-700">{sw.label}</div>
              </button>
            ); })}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Langues affichées" error={errors.languages?.message}><div className="flex gap-4 pt-2"><Checkbox value="fr" label="Français" {...register("languages")} /><Checkbox value="ar" label="العربية" {...register("languages")} /><Checkbox value="en" label="English" {...register("languages")} /></div></Field>
          <Field label="Orientation" error={errors.orientation?.message}><Select {...register("orientation")}><option value="landscape">Paysage</option><option value="portrait">Portrait</option></Select></Field>
          <Field label="Contenus"><div className="flex flex-col gap-2 pt-1"><Checkbox label="Afficher le Shuruq" {...register("showShuruq")} /><Checkbox label="Hadiths et versets en rotation" {...register("showHadith")} /><Checkbox label="Annonces de la mosquée" {...register("showAnnouncements")} /></div></Field>
          <div className="space-y-4">
            <Field label="Son à l'adhan" error={errors.adhanAudio?.message}><Select {...register("adhanAudio")}><option value="none">Aucun</option><option value="beep">Signal sonore</option><option value="full">Adhan complet</option></Select></Field>
            <Field label="Pendant la prière" error={errors.prayerScreen?.message}><Select {...register("prayerScreen")}><option value="phones_off">Message « éteignez vos téléphones »</option><option value="black">Écran noir</option></Select></Field>
          </div>
        </div>
        <fieldset className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
          <legend className="px-1 text-sm font-medium text-stone-700">Durées (minutes)</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Écran adhan" error={errors.durations?.adhan?.message}><Input type="number" min={1} max={10} {...register("durations.adhan", asNumber)} /></Field>
            <Field label="Écran iqama" error={errors.durations?.iqama?.message}><Input type="number" min={1} max={5} {...register("durations.iqama", asNumber)} /></Field>
            <Field label="Adhkar après la prière" error={errors.durations?.adhkar?.message}><Input type="number" min={0} max={20} {...register("durations.adhkar", asNumber)} /></Field>
            <Field label="Rotation des diapositives (s)" error={errors.slideDurationSec?.message}><Input type="number" min={5} max={60} {...register("slideDurationSec", asNumber)} /></Field>
          </div>
          <div className="mt-3 text-xs font-medium text-stone-600">Durée de la prière (écran noir / téléphones)</div>
          <div className="mt-1 grid grid-cols-5 gap-2">{PRAYERS.map((p) => <Field key={p} label={PRAYER_FR[p]} error={errors.durations?.prayer?.[p]?.message}><Input type="number" min={3} max={40} className="text-center" {...register(`durations.prayer.${p}`, asNumber)} /></Field>)}</div>
        </fieldset>
        <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
          {isDirty && <Button type="button" variant="ghost" onClick={() => reset(initial)}>Annuler</Button>}
          <Button type="submit" loading={save.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Card>
  );
}
