/** État dégradé : l'API ne répond pas. */
export function Unavailable({ retryHref }: { retryHref: string }) {
  return (
    <section role="alert" className="card mx-auto mt-10 max-w-xl p-8 text-center">
      <p className="eyebrow">Service momentanément indisponible</p>
      <h2 className="mt-3 text-2xl font-medium">Impossible de charger les horaires</h2>
      <p className="mt-3 text-muted">Nos serveurs ne répondent pas pour le moment. Les horaires de la mosquée ne sont pas modifiés — merci de réessayer dans un instant.</p>
      <a href={retryHref} className="btn btn-gold mt-6">Réessayer</a>
    </section>
  );
}
