import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl py-24 text-center">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="mt-3 text-3xl font-medium">Mosquée introuvable</h1>
      <p className="mt-3 text-muted">Cette page n'existe pas, ou la mosquée n'est pas encore publiée sur Nidaa.</p>
      <Link href="/" className="btn btn-gold mt-8">Rechercher une mosquée</Link>
    </section>
  );
}
