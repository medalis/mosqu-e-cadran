"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@nidaa/shared";
import type { z } from "zod";
import { useAuth } from "@/lib/auth";
import { AuthCard } from "@/components/AuthCard";
import { Button, Field, Input, ErrorBox } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { homeFor } from "@/lib/nav";

type Values = z.infer<typeof LoginSchema>;

function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(LoginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try {
      const me = await signIn(v);
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && next !== "/" ? next : homeFor(me));
    } catch (e) { setErr(errorMessage(e)); }
  });

  return (
    <AuthCard title="Connexion" subtitle="Accédez au back-office de votre mosquée." footer={<>Pas encore de compte ? <Link href="/register" className="font-medium text-gold-700 hover:underline">Créer un compte</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {err && <ErrorBox message={err} />}
        <Field label="Adresse e-mail" error={errors.email?.message} required><Input type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} /></Field>
        <Field label="Mot de passe" error={errors.password?.message} required><Input type="password" autoComplete="current-password" {...register("password")} aria-invalid={!!errors.password} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Se connecter</Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
