"use client";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { PrayerDay } from "@nidaa/shared";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, Stat } from "@/components/ui";
import { useToast } from "@/components/toast";
import { STATUS_LABEL, STATUS_TONE, todayIso, PRAYER_FR, isOnline, fmtDate, relativeTime } from "@/lib/utils";
import type { Announcement, ScreenDevice } from "@/lib/types";
import { TIMES } from "@nidaa/shared";

export default function DashboardPage() {
  const { id, mosque, invalidate } = useMosque();
  const toast = useToast();
  const today = todayIso(mosque?.timezone);
  const days = useQuery({ queryKey: ["prayer-days", id, today, today], queryFn: () => api.get<PrayerDay[]>(mPath(id, "/prayer-days"), { from: today, to: today }) });
  const screens = useQuery({ queryKey: ["screens", id], queryFn: () => api.get<ScreenDevice[]>(mPath(id, "/screens")), refetchInterval: 30_000 });
  const anns = useQuery({ queryKey: ["announcements", id], queryFn: () => api.get<Announcement[]>(mPath(id, "/announcements")) });
  const submit = useMutation({ mutationFn: () => api.post(mPath(id, "/submit")), onSuccess: async () => { await invalidate(); toast.success("Mosquée soumise", "Un super-administrateur va examiner votre fiche."); }, onError: (e) => toast.error("Soumission impossible", errorMessage(e)) });
  if (!mosque) return null;

  const day = days.data?.[0];
  const online = (screens.data ?? []).filter((s) => isOnline(s.lastSeenAt));
  const maxDrift = Math.max(0, ...(screens.data ?? []).map((s) => Math.abs(s.clockDriftMs ?? 0)));
  const now = Date.now();
  const active = (anns.data ?? []).filter((a) => a.isActive && (!a.startsAt || new Date(a.startsAt).getTime() <= now) && (!a.endsAt || new Date(a.endsAt).getTime() >= now));

  return (
    <>
      <PageHeader
        title={mosque.name}
        description={<span className="inline-flex flex-wrap items-center gap-2">{mosque.city} · <Badge tone={STATUS_TONE[mosque.status]}>{STATUS_LABEL[mosque.status]}</Badge>{mosque.status === "published" && <span className="text-stone-400">/{mosque.slug}</span>}</span>}
        actions={mosque.status === "draft" || mosque.status === "rejected" ? <Button onClick={() => submit.mutate()} loading={submit.isPending}>Soumettre à validation</Button> : undefined}
      />
      {mosque.status === "rejected" && mosque.rejectionReason && <div className="mb-4"><ErrorBox message={`Fiche refusée : ${mosque.rejectionReason}`} /></div>}
      {mosque.status === "pending" && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Votre fiche est en attente de validation. L'écran de la salle fonctionne déjà ; la page publique sera visible après validation.</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Écrans en ligne" value={screens.isPending ? "…" : `${online.length} / ${screens.data?.length ?? 0}`} tone="teal" hint={screens.data?.length ? `Dérive d'horloge max. ${Math.round(maxDrift / 1000)} s` : "Aucun écran appairé"} />
        <Stat label="Annonces actives" value={anns.isPending ? "…" : active.length} tone="gold" hint={`${anns.data?.length ?? 0} au total`} />
        <Stat label="Version de publication" value={mosque.version ?? "—"} hint="Incrémentée à chaque modification visible" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Horaires du jour" description={day ? `${fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })} · ${day.hijri.day} ${day.hijri.monthNameFr} ${day.hijri.year}` : today} className="lg:col-span-2" actions={<Link href={`/m/${id}/times`} className="text-sm font-medium text-gold-700 hover:underline">Gérer</Link>}>
          {days.isPending ? <Loading /> : days.isError ? <ErrorBox message={errorMessage(days.error)} onRetry={() => days.refetch()} /> : !day ? <Empty title="Aucun horaire pour aujourd'hui" description="Configurez la méthode de calcul ou importez un calendrier." /> : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {TIMES.map((k) => (
                <div key={k} className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-center">
                  <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{PRAYER_FR[k]}</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-stone-900">{day.times[k]}</div>
                  {k !== "shuruq" && <div className="mt-0.5 text-xs tabular-nums text-teal-700">Iqama {day.iqama[k]}</div>}
                </div>
              ))}
              <div className="col-span-full text-xs text-stone-500">Source : {day.source === "calculated" ? "calcul automatique" : day.source === "calendar" ? "calendrier importé" : "correction manuelle"}</div>
            </div>
          )}
        </Card>
        <Card title="Écrans" actions={<Link href={`/m/${id}/screens`} className="text-sm font-medium text-gold-700 hover:underline">Gérer</Link>}>
          {screens.isPending ? <Loading /> : screens.isError ? <ErrorBox message={errorMessage(screens.error)} /> : !screens.data?.length ? <Empty title="Aucun écran" description="Appairez un écran avec le code affiché dans la salle." /> : (
            <ul className="divide-y divide-stone-100 text-sm">
              {screens.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <div><div className="font-medium text-stone-800">{s.name ?? "Écran"}</div><div className="text-xs text-stone-500">{relativeTime(s.lastSeenAt)}</div></div>
                  <Badge tone={isOnline(s.lastSeenAt) ? "success" : "neutral"}>{isOnline(s.lastSeenAt) ? "En ligne" : "Hors ligne"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Annonces actives" className="mt-6" actions={<Link href={`/m/${id}/announcements`} className="text-sm font-medium text-gold-700 hover:underline">Gérer</Link>}>
        {anns.isPending ? <Loading /> : anns.isError ? <ErrorBox message={errorMessage(anns.error)} /> : !active.length ? <Empty title="Aucune annonce active" /> : (
          <ul className="divide-y divide-stone-100 text-sm">
            {active.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-2"><div><div className="font-medium text-stone-800">{a.title}</div>{a.body && <div className="line-clamp-1 text-xs text-stone-500">{a.body}</div>}</div><div className="flex gap-1">{a.targets.map((t) => <Badge key={t}>{t}</Badge>)}</div></li>)}
          </ul>
        )}
      </Card>
    </>
  );
}
