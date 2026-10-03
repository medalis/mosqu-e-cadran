"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IqamaRulesSchema, JumuaSlotSchema, SpecialPrayerSchema, type IqamaRule, type JumuaSlot, type Prayer, type SpecialPrayer } from "@nidaa/shared";
import { z } from "zod";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, Card, Dialog, Empty, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { useToast } from "@/components/toast";
import { emptyToNull, fmtDate, PRAYER_FR, PRAYERS5, SPECIAL_KIND_LABEL } from "@/lib/utils";
import type { SpecialPrayerItem } from "@/lib/types";

const DEFAULT_DELAY: Record<Prayer, number> = { fajr: 20, dhuhr: 15, asr: 15, maghrib: 5, isha: 15 };

export default function IqamaPage() {
  const { mosque } = useMosque();
  if (!mosque) return null;
  return (
    <>
      <PageHeader title="Iqama et Jumu'a" description="Délai ou heure fixe de l'iqama pour chaque prière, créneaux du vendredi et prières exceptionnelles." />
      <div className="grid gap-6 lg:grid-cols-2">
        <IqamaCard />
        <JumuaCard />
      </div>
      <SpecialCard />
    </>
  );
}

function IqamaCard() {
  const { id, mosque, invalidate } = useMosque();
  const qc = useQueryClient();
  const toast = useToast();
  const initial = (): IqamaRule[] => PRAYERS5.map((p) => mosque?.iqamaRules?.find((r) => r.prayer === p) ?? { prayer: p, mode: "delay" as const, delayMin: DEFAULT_DELAY[p], fixedTime: null });
  const [rules, setRules] = useState<IqamaRule[]>(initial);
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { setRules(initial()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mosque?.iqamaRules]);

  const save = useMutation({
    mutationFn: (v: IqamaRule[]) => api.put<IqamaRule[]>(mPath(id, "/iqama-rules"), v),
    onSuccess: async () => { await invalidate(); await qc.invalidateQueries({ queryKey: ["prayer-days", id] }); toast.success("Règles d'iqama enregistrées", "Les horaires ont été recalculés."); },
    onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)),
  });
  const update = (p: Prayer, patch: Partial<IqamaRule>) => setRules((rs) => rs.map((r) => (r.prayer === p ? ({ ...r, ...patch } as IqamaRule) : r)));
  const submit = () => {
    const normalized = rules.map((r) => (r.mode === "delay" ? { ...r, fixedTime: null } : { ...r, delayMin: null }));
    const parsed = IqamaRulesSchema.safeParse(normalized);
    if (!parsed.success) { const e: Record<string, string> = {}; for (const i of parsed.error.issues) { const idx = Number(i.path[0]); e[normalized[idx]?.prayer ?? idx] = i.message; } setErrs(e); return; }
    setErrs({}); save.mutate(parsed.data);
  };
  return (
    <Card title="Iqama par prière" description="Délai en minutes après l'adhan, ou heure fixe.">
      <div className="space-y-3">
        {rules.map((r) => (
          <div key={r.prayer} className="grid grid-cols-[5rem_1fr_1fr] items-center gap-3">
            <div className="font-medium text-stone-800">{PRAYER_FR[r.prayer]}</div>
            <Select value={r.mode} onChange={(e) => update(r.prayer, { mode: e.target.value as IqamaRule["mode"], delayMin: e.target.value === "delay" ? (r.delayMin ?? DEFAULT_DELAY[r.prayer]) : null, fixedTime: e.target.value === "fixed" ? (r.fixedTime ?? "19:30") : null })}>
              <option value="delay">Délai après l'adhan</option><option value="fixed">Heure fixe</option>
            </Select>
            {r.mode === "delay"
              ? <div className="flex items-center gap-2"><Input type="number" min={0} max={120} value={r.delayMin ?? 0} onChange={(e) => update(r.prayer, { delayMin: Number(e.target.value) })} className="tabular-nums" aria-invalid={!!errs[r.prayer]} /><span className="text-sm text-stone-500">min</span></div>
              : <Input type="time" value={r.fixedTime ?? ""} onChange={(e) => update(r.prayer, { fixedTime: e.target.value || null })} aria-invalid={!!errs[r.prayer]} />}
            {errs[r.prayer] && <div className="col-span-3 text-xs text-red-600">{errs[r.prayer]}</div>}
          </div>
        ))}
        <div className="flex justify-end border-t border-stone-100 pt-4"><Button onClick={submit} loading={save.isPending}>Enregistrer et recalculer</Button></div>
      </div>
    </Card>
  );
}

function JumuaCard() {
  const { id, mosque, invalidate } = useMosque();
  const toast = useToast();
  const [slots, setSlots] = useState<JumuaSlot[]>(() => mosque?.jumuaSlots ?? []);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setSlots(mosque?.jumuaSlots ?? []); }, [mosque?.jumuaSlots]);
  const save = useMutation({
    mutationFn: (v: JumuaSlot[]) => api.put<JumuaSlot[]>(mPath(id, "/jumua"), v),
    onSuccess: async () => { await invalidate(); toast.success("Créneaux de Jumu'a enregistrés"); },
    onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)),
  });
  const submit = () => {
    const parsed = z.array(JumuaSlotSchema).safeParse(slots.map((s, i) => ({ ...s, position: i })));
    if (!parsed.success) { setErr("Vérifiez les heures (format HH:MM) de chaque créneau."); return; }
    setErr(null); save.mutate(parsed.data);
  };
  const set = (i: number, patch: Partial<JumuaSlot>) => setSlots((xs) => xs.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <Card title="Jumu'a (vendredi)" description="Un ou plusieurs créneaux : heure du prêche (khutba) et de la prière." actions={<Button size="sm" variant="outline" onClick={() => setSlots([...slots, { khutbaTime: "12:30", prayerTime: "13:00", language: null, position: slots.length }])}>+ Ajouter un créneau</Button>}>
      {!slots.length ? <Empty title="Aucun créneau" description="Ajoutez au moins un créneau pour l'afficher sur l'écran et la page publique." /> : (
        <div className="space-y-3">
          {slots.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
              <Field label={`Khutba ${i + 1}`}><Input type="time" value={s.khutbaTime} onChange={(e) => set(i, { khutbaTime: e.target.value })} /></Field>
              <Field label="Prière"><Input type="time" value={s.prayerTime} onChange={(e) => set(i, { prayerTime: e.target.value })} /></Field>
              <Field label="Langue"><Input placeholder="ar, fr, so…" maxLength={8} value={s.language ?? ""} onChange={(e) => set(i, { language: e.target.value || null })} /></Field>
              <Button variant="ghost" className="text-red-700" onClick={() => setSlots(slots.filter((_, j) => j !== i))} aria-label="Supprimer">✕</Button>
            </div>
          ))}
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end border-t border-stone-100 pt-4"><Button onClick={submit} loading={save.isPending}>Enregistrer</Button></div>
    </Card>
  );
}

function SpecialCard() {
  const { id, mosque, invalidate } = useMosque();
  const toast = useToast();
  const items = mosque?.specialPrayers ?? [];
  const [editing, setEditing] = useState<SpecialPrayerItem | "new" | null>(null);
  const del = useMutation({ mutationFn: (spId: string) => api.delete(mPath(id, `/special-prayers/${spId}`)), onSuccess: async () => { await invalidate(); toast.success("Prière supprimée"); }, onError: (e) => toast.error("Suppression impossible", errorMessage(e)) });
  return (
    <Card className="mt-6" padded={false} title="Prières exceptionnelles" description="Aïd, Tarawih, prières spéciales : affichées sur l'écran et la page publique à l'approche de la date." actions={<Button size="sm" onClick={() => setEditing("new")}>+ Ajouter</Button>}>
      {!items.length ? <div className="p-4"><Empty title="Aucune prière exceptionnelle" /></div> : (
        <Table head={["Type", "Libellé", "Date", "Heure", "Lieu", ""]}>
          {items.map((s) => (
            <tr key={s.id}>
              <Td><Badge tone="gold">{SPECIAL_KIND_LABEL[s.kind]}</Badge></Td><Td className="font-medium text-stone-800">{s.label}</Td><Td>{fmtDate(s.date)}</Td><Td className="tabular-nums">{s.time}</Td><Td className="text-stone-500">{s.locationNote ?? "—"}</Td>
              <Td className="whitespace-nowrap text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Modifier</Button><Button size="sm" variant="ghost" className="text-red-700" onClick={() => { if (confirm("Supprimer cette prière ?")) del.mutate(s.id); }}>Supprimer</Button></Td>
            </tr>
          ))}
        </Table>
      )}
      {editing && <SpecialDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function SpecialDialog({ item, onClose }: { item: SpecialPrayerItem | null; onClose: () => void }) {
  const { id, invalidate } = useMosque();
  const toast = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<SpecialPrayer>({ resolver: zodResolver(SpecialPrayerSchema), defaultValues: item ? { kind: item.kind, label: item.label, date: item.date, time: item.time, locationNote: item.locationNote } : { kind: "eid_fitr", label: "Prière de l'Aïd", date: "", time: "06:30", locationNote: null } });
  const save = useMutation({
    mutationFn: (v: SpecialPrayer) => (item ? api.patch(mPath(id, `/special-prayers/${item.id}`), v) : api.post(mPath(id, "/special-prayers"), v)),
    onSuccess: async () => { await invalidate(); toast.success(item ? "Prière modifiée" : "Prière ajoutée"); onClose(); },
    onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)),
  });
  return (
    <Dialog open onClose={onClose} title={item ? "Modifier la prière" : "Nouvelle prière exceptionnelle"} footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={handleSubmit((v) => save.mutate(v))} loading={save.isPending}>Enregistrer</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Field label="Type" error={errors.kind?.message}><Select {...register("kind")}>{Object.entries(SPECIAL_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Libellé" error={errors.label?.message} required><Input {...register("label")} /></Field>
        <Field label="Date" error={errors.date?.message} required><Input type="date" {...register("date")} /></Field>
        <Field label="Heure" error={errors.time?.message} required><Input type="time" {...register("time")} /></Field>
        <Field label="Lieu / remarque" error={errors.locationNote?.message} className="sm:col-span-2"><Input placeholder="ex. Esplanade, apporter un tapis" {...register("locationNote", emptyToNull)} /></Field>
      </form>
    </Dialog>
  );
}
