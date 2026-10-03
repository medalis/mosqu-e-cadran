"use client";
import { useMutation } from "@tanstack/react-query";
import type { MosqueInput } from "@nidaa/shared";
import { useMosque, mPath } from "@/lib/mosque";
import { api, errorMessage } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { MosqueForm } from "@/components/MosqueForm";
import { PhotosCard } from "@/components/PhotosCard";
import { useToast } from "@/components/toast";
import type { Mosque } from "@/lib/types";

export default function MosqueInfoPage() {
  const { id, mosque, invalidate } = useMosque();
  const toast = useToast();
  const save = useMutation({ mutationFn: (v: MosqueInput) => api.patch<Mosque>(mPath(id), v), onSuccess: async () => { await invalidate(); toast.success("Fiche enregistrée"); }, onError: (e) => toast.error("Enregistrement impossible", errorMessage(e)) });
  if (!mosque) return null;
  const initial: Partial<MosqueInput> = { name: mosque.name, nameAr: mosque.nameAr, description: mosque.description, address: mosque.address, city: mosque.city, countryCode: mosque.countryCode, latitude: mosque.latitude, longitude: mosque.longitude, timezone: mosque.timezone, phone: mosque.phone, email: mosque.email, website: mosque.website, donationUrl: mosque.donationUrl, services: mosque.services ?? [] };
  return (
    <>
      <PageHeader title="Fiche mosquée" description="Informations publiques, géolocalisation et services. Les coordonnées et le fuseau horaire déterminent le calcul des horaires." />
      <Card>
        <MosqueForm key={mosque.updatedAt ?? mosque.version} initial={initial} onSubmit={async (v) => { await save.mutateAsync(v); }} submitting={save.isPending} />
      </Card>
      <PhotosCard />
    </>
  );
}
