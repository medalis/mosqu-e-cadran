"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CALC_METHODS, HIGH_LAT_RULES, PrayerConfigSchema, TIMES, type IqamaRule, type PrayerConfig, type PrayerDay, type TimeKey } from "@nidaa/shared";
import { parseCalendarCsv, resolveRange } from "@nidaa/prayer-engine";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, Card, Checkbox, Dialog, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Table, Tabs, Td, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { addDaysIso, asNumber, cn, fmtDayLong, HIGH_LAT_LABEL, METHOD_LABEL, monthRange, numOrNull, PRAYER_FR, PRAYERS5, todayIso } from "@/lib/utils";
import type { ImportReport } from "@/lib/types";

const DEFAULT_CONFIG: PrayerConfig = PrayerConfigSchema.parse({});
const SOURCE_LABEL = { calculated: "calcul", calendar: "calendrier", override: "correction" } as const;
const SOURCE_TONE = { calculated: "neutral", calendar: "info", override: "gold" } as const;

export default function TimesPage() {
  const { mosque } = useMosque();
  const [tab, setTab] = useState<"auto" | "csv">(mosque?.prayerConfig?.source === "calendar" ? "csv" : "auto");
  if (!mosque) return null;
  return (
    <>
      <PageHeader title="Horaires de prière" description="Calcul astronomique paramétrable ou calendrier annuel importé. L'horaire de la mosquée fait toujours foi : une correction manuelle remplace le calcul." />
      <Tabs value={tab} onChange={setTab} items={[{ value: "auto", label: "Calcul automatique" }, { value: "csv", label: "Calendrier CSV" }]} />
      {tab === "auto" ? <AutoTab /> : <CsvTab />}
      <MonthView />
    </>
  );
}

// ---------------- Calcul automatique ----------------
function AutoTab() {
  const { id, mosque, invalidate } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const initial = useMemo(() => PrayerConfigSchema.parse({ ...DEFAULT_CONFIG, ...(mosque?.prayerConfig ?? {}), source: "calculated" }), [mosque?.prayerConfig]);
  const form = useForm<PrayerConfig>({ resolver: zodResolver(PrayerConfigSchema), defaultValues: initial });
  const { register, handleSubmit, control, formState: { errors, isDirty }, reset } = form;
  const watched = useWatch({ control });
  const iqamaRules = (mosque?.iqamaRules ?? []) as IqamaRule[];
  const from = todayIso(mosque?.timezone);

  // Aperçu local instantané (prayer-engine) pendant la saisie
  const localPreview = useMemo<PrayerDay[] | null>(() => {
    if (!mosque) return null;
    const parsed = PrayerConfigSchema.safeParse(watched);
    if (!parsed.success) return null;
    try { return resolveRange({ latitude: mosque.latitude, longitude: mosque.longitude, timezone: mosque.timezone, config: parsed.data, iqamaRules }, from, 7); } catch { return null; }
  }, [watched, mosque, iqamaRules, from]);

  // Aperçu serveur (autoritaire) au blur / à la soumission
  const [serverPreview, setServerPreview] = useState<PrayerDay[] | null>(null);
  const [previewStale, setPreviewStale] = useState(false);
  const preview = useMutation({
    mutationFn: (config: PrayerConfig) => api.post<PrayerDay[]>(mPath(id, "/prayer-config/preview"), { config, from, days: 7 }),
    onSuccess: (d) => { setServerPreview(d); setPreviewStale(false); },
  });
  const lastSent = useRef<string>("");
  const requestServerPreview = () => {
    const parsed = PrayerConfigSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    const key = JSON.stringify(parsed.data);
    if (key === lastSent.current && serverPreview) { setPreviewStale(false); return; }
    lastSent.current = key;
    preview.mutate(parsed.data);
  };
  useEffect(() => { setPreviewStale(true); }, [watched]);
  useEffect(() => { requestServerPreview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = useMutation({
    mutationFn: (v: PrayerConfig) => api.put<PrayerConfig>(mPath(id, "/prayer-config"), v),
    onSuccess: async (saved) => { await invalidate(); await qc.invalidateQueries({ queryKey: ["prayer-days", id] }); reset(PrayerConfigSchema.parse({ ...saved, source: "calculated" })); toast.success("Configuration enregistrée", "Les horaires ont été recalculés."); },
    onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)),
  });

  const rows = serverPreview && !previewStale ? serverPreview : localPreview ?? serverPreview;
  const isCustom = watched.method === "Custom";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title="Paramètres de calcul" description={mosque?.prayerConfig?.source === "calendar" ? "Un calendrier importé est actuellement la source principale ; enregistrer ici rebascule sur le calcul." : undefined} className="lg:col-span-3">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} onBlur={requestServerPreview} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Méthode de calcul" error={errors.method?.message} className="sm:col-span-2"><Select {...register("method")}>{CALC_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m] ?? m}</option>)}</Select></Field>
            <Field label="Angle Fajr (°)" error={errors.fajrAngle?.message} hint={isCustom ? "Requis en méthode personnalisée." : "Vide = valeur de la méthode."}><Input type="number" step="0.1" min={10} max={24} placeholder="ex. 18" {...register("fajrAngle", numOrNull)} /></Field>
            <Field label="Angle Isha (°)" error={errors.ishaAngle?.message} hint="Vide = valeur de la méthode."><Input type="number" step="0.1" min={10} max={24} placeholder="ex. 17" {...register("ishaAngle", numOrNull)} /></Field>
            <Field label="Isha : intervalle fixe (min après Maghrib)" error={errors.ishaIntervalMin?.message} hint="Remplace l'angle Isha (ex. 90 pour Umm al-Qura)."><Input type="number" min={0} max={180} {...register("ishaIntervalMin", numOrNull)} /></Field>
            <Field label="Madhhab pour l'Asr" error={errors.asrMadhhab?.message}><Select {...register("asrMadhhab")}><option value="shafi">Majorité (Shafi'i, Maliki, Hanbali)</option><option value="hanafi">Hanafi</option></Select></Field>
            <Field label="Règle hautes latitudes" error={errors.highLatitudeRule?.message} className="sm:col-span-2"><Select {...register("highLatitudeRule")}>{HIGH_LAT_RULES.map((r) => <option key={r} value={r}>{HIGH_LAT_LABEL[r]}</option>)}</Select></Field>
          </div>
          <fieldset className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
            <legend className="px-1 text-sm font-medium text-stone-700">Ajustements manuels (minutes, de −60 à +60)</legend>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {TIMES.map((k) => <Field key={k} label={PRAYER_FR[k]} error={errors.adjustments?.[k]?.message}><Input type="number" min={-60} max={60} className="text-center tabular-nums" {...register(`adjustments.${k}`, asNumber)} /></Field>)}
            </div>
          </fieldset>
          <Field label="Décalage du calendrier hégirien (jours)" error={errors.hijriOffsetDays?.message} hint="Pour aligner la date hégirienne sur l'observation locale de la lune (−2 à +2)." className="sm:w-1/2"><Input type="number" min={-2} max={2} {...register("hijriOffsetDays", asNumber)} /></Field>
          <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
            {isDirty && <Button type="button" variant="ghost" onClick={() => reset(initial)}>Annuler</Button>}
            <Button type="submit" loading={save.isPending}>Enregistrer et recalculer</Button>
          </div>
        </form>
      </Card>

      <Card title="Aperçu des 7 prochains jours" description={previewStale || !serverPreview ? "Aperçu calculé localement pendant la saisie." : "Aperçu confirmé par le serveur."} className="lg:col-span-2" padded={false} actions={preview.isPending ? <Badge tone="neutral">Vérification…</Badge> : previewStale && serverPreview ? <Badge tone="warning">Local</Badge> : serverPreview ? <Badge tone="success">Serveur</Badge> : null}>
        {preview.isError && <div className="p-3"><ErrorBox message={errorMessage(preview.error)} onRetry={requestServerPreview} /></div>}
        {!rows ? <div className="p-5 text-sm text-stone-500">Corrigez les erreurs du formulaire pour afficher l'aperçu.</div> : (
          <Table head={["Jour", ...TIMES.map((k) => PRAYER_FR[k])]}>
            {rows.map((d) => (
              <tr key={d.date} className="tabular-nums">
                <Td className="whitespace-nowrap text-stone-600">{fmtDayLong(d.date)}<div className="text-[11px] text-stone-400">{d.hijri.day} {d.hijri.monthNameFr}</div></Td>
                {TIMES.map((k) => <Td key={k} className="font-medium text-stone-900">{d.times[k]}</Td>)}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

// ---------------- Calendrier CSV ----------------
function CsvTab() {
  const { id, mosque, invalidate } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [setAsSource, setSetAsSource] = useState(true);
  const [report, setReport] = useState<ImportReport | null>(null);
  const local = useMemo(() => (csv.trim() ? parseCalendarCsv(csv) : null), [csv]);

  const importMut = useMutation({
    mutationFn: async () => {
      const r = await api.post<ImportReport>(mPath(id, "/calendar/import"), { csv, fileName });
      if (setAsSource && r.imported > 0 && mosque?.prayerConfig && mosque.prayerConfig.source !== "calendar") {
        await api.put(mPath(id, "/prayer-config"), { ...PrayerConfigSchema.parse(mosque.prayerConfig), source: "calendar" });
      }
      return r;
    },
    onSuccess: async (r) => { setReport(r); await invalidate(); await qc.invalidateQueries({ queryKey: ["prayer-days", id] }); if (r.imported > 0) toast.success(`${r.imported} jour(s) importé(s)`); else toast.error("Aucune ligne importée", "Consultez le rapport ci-dessous."); },
    onError: (e) => toast.error("Import impossible", errorMessage(e)),
  });

  const downloadTemplate = async () => {
    try {
      const text = await api.text(mPath(id, "/calendar/template"));
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `calendrier-${mosque?.slug ?? "mosquee"}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error("Téléchargement impossible", errorMessage(e)); }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    f.text().then(setCsv).catch(() => toast.error("Lecture du fichier impossible"));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title="Importer un calendrier annuel" description="Format : date,fajr,shuruq,dhuhr,asr,maghrib,isha — une ligne par jour, séparateur « , » ou « ; », dates YYYY-MM-DD ou JJ/MM/AAAA." className="lg:col-span-3" actions={<Button variant="outline" size="sm" onClick={downloadTemplate}>Télécharger le modèle</Button>}>
        <div className="space-y-4">
          <Field label="Fichier CSV"><Input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} className="file:mr-3 file:rounded file:border-0 file:bg-stone-100 file:px-3 file:py-1 file:text-sm" /></Field>
          <Field label="Ou collez le contenu" hint={local ? `${local.rows.length} ligne(s) valide(s), ${local.errors.length} erreur(s) détectée(s) localement.` : undefined}>
            <Textarea rows={10} className="font-mono text-xs" placeholder={"date,fajr,shuruq,dhuhr,asr,maghrib,isha\n2026-01-01,05:12,06:28,12:10,15:30,17:52,19:05"} value={csv} onChange={(e) => setCsv(e.target.value)} />
          </Field>
          {local && local.errors.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {local.errors.slice(0, 50).map((e, i) => <div key={i}>Ligne {e.line} : {e.message}</div>)}
              {local.errors.length > 50 && <div>… et {local.errors.length - 50} autre(s)</div>}
            </div>
          )}
          <Checkbox label="Définir le calendrier importé comme source principale des horaires" checked={setAsSource} onChange={(e) => setSetAsSource(e.target.checked)} />
          <div className="flex justify-end border-t border-stone-100 pt-4"><Button onClick={() => importMut.mutate()} disabled={!csv.trim()} loading={importMut.isPending}>Importer</Button></div>
        </div>
      </Card>
      <Card title="Rapport d'import" className="lg:col-span-2">
        {!report ? <Empty title="Aucun import effectué" description="Le rapport détaillé des lignes importées et des erreurs s'affichera ici." /> : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Badge tone={report.imported ? "success" : "danger"}>{report.imported} importé(s)</Badge><Badge tone={report.errors.length ? "warning" : "neutral"}>{report.errors.length} erreur(s)</Badge></div>
            {report.errors.length > 0 && (
              <ul className="max-h-80 divide-y divide-stone-100 overflow-auto rounded-md border border-stone-200 text-xs">
                {report.errors.map((e, i) => <li key={i} className="flex gap-2 px-3 py-1.5"><span className="w-16 shrink-0 font-mono text-stone-500">L. {e.line}</span><span className="text-stone-800">{e.message}</span></li>)}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------- Vue mensuelle ----------------
function MonthView() {
  const { id, mosque } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const [month, setMonth] = useState(() => todayIso(mosque?.timezone).slice(0, 7));
  const { from, to } = monthRange(month);
  const q = useQuery({ queryKey: ["prayer-days", id, from, to], queryFn: () => api.get<PrayerDay[]>(mPath(id, "/prayer-days"), { from, to }) });
  const [editing, setEditing] = useState<PrayerDay | null>(null);
  const today = todayIso(mosque?.timezone);

  const removeOverride = useMutation({
    mutationFn: (date: string) => api.delete(mPath(id, `/prayer-days/${date}/override`)),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["prayer-days", id] }); toast.success("Correction supprimée", "Le jour a été recalculé."); },
    onError: (e) => toast.error("Suppression impossible", errorMessage(e)),
  });

  const shift = (n: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };

  return (
    <Card className="mt-6" padded={false} title="Calendrier mensuel" description="Corrigez un jour précis (adhan ou iqama) ; la correction est conservée même après un recalcul."
      actions={<div className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Mois précédent">‹</Button><Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-40 py-0 text-xs" /><Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Mois suivant">›</Button></div>}>
      {q.isPending ? <Loading /> : q.isError ? <div className="p-4"><ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div> : !q.data.length ? <div className="p-4"><Empty title="Aucun horaire pour ce mois" description="Les horaires sont résolus sur 400 jours à partir d'hier ; au-delà, enregistrez la configuration pour les générer." /></div> : (
        <Table head={["Date", "Hégirien", ...TIMES.map((k) => PRAYER_FR[k]), "Source", ""]}>
          {q.data.map((d) => (
            <tr key={d.date} className={cn("tabular-nums", d.date === today && "bg-gold-50/60")}>
              <Td className="whitespace-nowrap font-medium text-stone-800">{fmtDayLong(d.date)}</Td>
              <Td className="whitespace-nowrap text-xs text-stone-500">{d.hijri.day} {d.hijri.monthNameFr}</Td>
              {TIMES.map((k) => <Td key={k}><div>{d.times[k]}</div>{k !== "shuruq" && <div className="text-[11px] text-teal-700">{d.iqama[k]}</div>}</Td>)}
              <Td><Badge tone={SOURCE_TONE[d.source]}>{SOURCE_LABEL[d.source]}</Badge></Td>
              <Td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>Corriger</Button>
                {d.source === "override" && <Button size="sm" variant="ghost" className="text-red-700" onClick={() => removeOverride.mutate(d.date)} loading={removeOverride.isPending && removeOverride.variables === d.date}>Supprimer la correction</Button>}
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {editing && <OverrideDialog day={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function OverrideDialog({ day, onClose }: { day: PrayerDay; onClose: () => void }) {
  const { id } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const [times, setTimes] = useState<Record<TimeKey, string>>({ ...day.times });
  const [iqama, setIqama] = useState<Record<string, string>>({ ...day.iqama });
  const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const invalid = [...Object.values(times), ...Object.values(iqama)].some((v) => !HM.test(v));
  const save = useMutation({
    mutationFn: () => {
      const tDiff: Partial<Record<TimeKey, string>> = {}; const iDiff: Record<string, string> = {};
      for (const k of TIMES) if (times[k] !== day.times[k]) tDiff[k] = times[k];
      for (const k of PRAYERS5) if (iqama[k] !== day.iqama[k]) iDiff[k] = iqama[k];
      return api.patch<PrayerDay>(mPath(id, `/prayer-days/${day.date}`), { times: tDiff, iqama: iDiff });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["prayer-days", id] }); toast.success("Correction enregistrée"); onClose(); },
    onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)),
  });
  return (
    <Dialog open onClose={onClose} title={`Corriger le ${fmtDayLong(day.date)} (${addDaysIso(day.date, 0)})`} footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={() => save.mutate()} disabled={invalid} loading={save.isPending}>Enregistrer la correction</Button></>}>
      <div className="space-y-4 text-sm">
        <div>
          <div className="mb-2 font-medium text-stone-700">Adhan</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{TIMES.map((k) => <Field key={k} label={PRAYER_FR[k]}><Input value={times[k]} onChange={(e) => setTimes({ ...times, [k]: e.target.value })} className="text-center tabular-nums" placeholder="HH:MM" aria-invalid={!HM.test(times[k])} /></Field>)}</div>
        </div>
        <div>
          <div className="mb-2 font-medium text-stone-700">Iqama</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{PRAYERS5.map((k) => <Field key={k} label={PRAYER_FR[k]}><Input value={iqama[k]} onChange={(e) => setIqama({ ...iqama, [k]: e.target.value })} className="text-center tabular-nums" placeholder="HH:MM" aria-invalid={!HM.test(iqama[k])} /></Field>)}</div>
        </div>
        <p className="text-xs text-stone-500">Seules les valeurs modifiées sont envoyées. Format HH:MM en heure locale de la mosquée.</p>
      </div>
    </Dialog>
  );
}
