"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MosqueInputSchema, SERVICES, type MosqueInput } from "@nidaa/shared";
import { Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { emptyToNull, SERVICE_LABEL } from "@/lib/utils";
import { useState } from "react";

const DEFAULTS: MosqueInput = { name: "", nameAr: null, description: null, address: null, city: "Djibouti", countryCode: "DJ", latitude: 11.588, longitude: 43.145, timezone: "Africa/Djibouti", phone: null, email: null, website: null, donationUrl: null, services: [] };

export function MosqueForm({ initial, onSubmit, submitLabel = "Enregistrer", submitting }: { initial?: Partial<MosqueInput>; onSubmit: (v: MosqueInput) => Promise<void> | void; submitLabel?: string; submitting?: boolean }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<MosqueInput>({ resolver: zodResolver(MosqueInputSchema), defaultValues: { ...DEFAULTS, ...initial } });
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error" | "unsupported">("idle");

  const useMyPosition = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoState("unsupported"); return; }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setValue("latitude", +pos.coords.latitude.toFixed(6), { shouldDirty: true }); setValue("longitude", +pos.coords.longitude.toFixed(6), { shouldDirty: true }); setGeoState("idle"); },
      () => setGeoState("error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v))} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de la mosquée" error={errors.name?.message} required><Input placeholder="Mosquée Al-Rahma" {...register("name")} /></Field>
        <Field label="Nom en arabe" error={errors.nameAr?.message}><Input dir="rtl" placeholder="مسجد الرحمة" {...register("nameAr", emptyToNull)} /></Field>
      </div>
      <Field label="Description" error={errors.description?.message} hint="Présentation affichée sur la page publique."><Textarea rows={3} {...register("description", emptyToNull)} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Adresse" error={errors.address?.message} className="sm:col-span-2"><Input {...register("address", emptyToNull)} /></Field>
        <Field label="Ville" error={errors.city?.message} required><Input {...register("city")} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code pays" error={errors.countryCode?.message} hint="2 lettres (ISO)."><Input maxLength={2} className="uppercase" {...register("countryCode", { setValueAs: (v: string) => (v ?? "").toUpperCase() })} /></Field>
        <Field label="Fuseau horaire" error={errors.timezone?.message} hint="Identifiant IANA." className="sm:col-span-2"><Input placeholder="Africa/Djibouti" {...register("timezone")} /></Field>
      </div>
      <fieldset className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
        <legend className="px-1 text-sm font-medium text-stone-700">Géolocalisation</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Latitude" error={errors.latitude?.message} required><Input type="number" step="0.000001" {...register("latitude", { valueAsNumber: true })} /></Field>
          <Field label="Longitude" error={errors.longitude?.message} required><Input type="number" step="0.000001" {...register("longitude", { valueAsNumber: true })} /></Field>
          <div className="flex items-end"><Button type="button" variant="outline" className="w-full" onClick={useMyPosition} loading={geoState === "loading"}>Utiliser ma position</Button></div>
        </div>
        {geoState === "error" && <p className="mt-2 text-xs text-red-600">Position indisponible : autorisez la géolocalisation ou saisissez les coordonnées manuellement.</p>}
        {geoState === "unsupported" && <p className="mt-2 text-xs text-red-600">La géolocalisation n'est pas disponible sur cet appareil.</p>}
        <p className="mt-2 text-xs text-stone-500">Les coordonnées servent au calcul des horaires et à la recherche « autour de moi ». Par défaut : Djibouti (11.588, 43.145).</p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone" error={errors.phone?.message}><Input type="tel" {...register("phone", emptyToNull)} /></Field>
        <Field label="E-mail de contact" error={errors.email?.message}><Input type="email" {...register("email", emptyToNull)} /></Field>
        <Field label="Site web" error={errors.website?.message}><Input type="url" placeholder="https://…" {...register("website", emptyToNull)} /></Field>
        <Field label="Lien de collecte de dons" error={errors.donationUrl?.message} hint="Affiché sur la page publique et dans l'application."><Input type="url" placeholder="https://…" {...register("donationUrl", emptyToNull)} /></Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-stone-700">Services proposés</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SERVICES.map((s) => <Checkbox key={s} value={s} label={SERVICE_LABEL[s] ?? s} {...register("services")} />)}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
        <Button type="submit" loading={submitting ?? isSubmitting} disabled={initial && !isDirty && !submitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
