"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Loading, ErrorBox } from "@/components/ui";
import { errorMessage } from "@/lib/api";

export function RequireAuth({ children, superOnly = false }: { children: ReactNode; superOnly?: boolean }) {
  const { ready, isAuthenticated, me, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (ready && !isAuthenticated && !error) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, isAuthenticated, error, router, pathname]);
  if (!ready) return <div className="flex min-h-screen items-center justify-center"><Loading /></div>;
  if (error && !me) return <div className="mx-auto mt-20 max-w-md"><ErrorBox message={errorMessage(error)} onRetry={() => window.location.reload()} /></div>;
  if (!isAuthenticated || !me) return <div className="flex min-h-screen items-center justify-center"><Loading /></div>;
  if (superOnly && !me.isSuperAdmin) return <div className="mx-auto mt-20 max-w-md"><ErrorBox message="Cette section est réservée aux super-administrateurs." /></div>;
  return <>{children}</>;
}
