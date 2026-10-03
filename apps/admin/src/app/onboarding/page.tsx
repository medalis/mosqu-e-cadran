"use client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { MosqueInput } from "@nidaa/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Shell } from "@/components/Shell";
import { Card, PageHeader } from "@/components/ui";
import { MosqueForm } from "@/components/MosqueForm";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast";
import type { Mosque } from "@/lib/types";
import { rememberMosque } from "@/lib/nav";

export default function OnboardingPage() {
  return <RequireAuth><Onboarding /></RequireAuth>;
}

function Onboarding() {
  const router = useRouter();
  const { me, refetchMe } = useAuth();
  const toast = useToast();
  const create = useMutation({
    mutationFn: (v: MosqueInput) => api.post<Mosque>("/admin/mosques", v),
    onSuccess: async (m) => { await refetchMe(); rememberMosque(m.id); toast.success("Mosquée créée", "Complétez les horaires puis soumettez-la à validation."); router.replace(`/m/${m.id}`); },
    onError: (e) => toast.error("Création impossible", errorMessage(e)),
  });
  const first = (me?.memberships.length ?? 0) === 0;
  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <PageHeader title={first ? "Bienvenue sur Nidaa" : "Nouvelle mosquée"} description={first ? "Commencez par créer la fiche de votre mosquée. Elle restera en brouillon jusqu'à sa validation par l'équipe Nidaa." : "Créez la fiche d'une autre mosquée dont vous êtes responsable."} />
        <Card>
          <MosqueForm onSubmit={async (v) => { await create.mutateAsync(v); }} submitLabel="Créer la mosquée" submitting={create.isPending} />
        </Card>
      </div>
    </Shell>
  );
}
