"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema } from "@nidaa/shared";
import type { z } from "zod";
import { useAuth } from "@/lib/auth";
import { AuthCard } from "@/components/AuthCard";
import { Button, Field, Input, Select, ErrorBox } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { emptyToNull } from "@/lib/utils";

type Values = z.infer<typeof RegisterSchema>;

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(RegisterSchema), defaultValues: { email: "", password: "", fullName: "", phone: null, locale: "fr" } });

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try { await signUp(v); router.replace("/onboarding"); } catch (e) { setErr(errorMessage(e)); }
  });

  return (
    <AuthCard title="Créer un compte" subtitle="Le compte du responsable de la mosquée. Vous créerez ensuite la fiche de votre mosquée." footer={<>Déjà inscrit ? <Link href="/login" className="font-medium text-gold-700 hover:underline">Se connecter</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {err && <ErrorBox message={err} />}
        <Field label="Nom complet" error={errors.fullName?.message} required><Input autoComplete="name" {...register("fullName")} /></Field>
        <Field label="Adresse e-mail" error={errors.email?.message} required><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Mot de passe" error={errors.password?.message} hint="8 caractères minimum." required><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone" error={errors.phone?.message}><Input type="tel" {...register("phone", emptyToNull)} /></Field>
          <Field label="Langue" error={errors.locale?.message}><Select {...register("locale")}><option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option></Select></Field>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Créer mon compte</Button>
      </form>
    </AuthCard>
  );
}
