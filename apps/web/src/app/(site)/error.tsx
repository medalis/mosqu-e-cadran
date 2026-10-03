"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="card mx-auto mt-10 max-w-xl p-8 text-center">
      <p className="eyebrow">Une erreur est survenue</p>
      <h1 className="mt-3 text-2xl font-medium">Cette page n'a pas pu s'afficher</h1>
      <p className="mt-3 text-muted">Merci de réessayer dans un instant.</p>
      <button type="button" onClick={reset} className="btn btn-gold mt-6">Réessayer</button>
    </section>
  );
}
