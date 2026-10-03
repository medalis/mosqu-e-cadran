"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";
import { homeFor } from "@/lib/nav";

export default function Home() {
  const { me, ready, isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated || !me) { router.replace("/login"); return; }
    router.replace(homeFor(me));
  }, [ready, isAuthenticated, me, router]);
  return <div className="flex min-h-screen items-center justify-center"><Loading /></div>;
}
