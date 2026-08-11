/**
 * Artwork on this screen is resolved from the public Cinemeta catalog, so the
 * credit names Cinemeta. It deliberately claims no relationship with TMDB.
 */
export function PosterCredit() {
  return (
    <section
      aria-label="Artwork credits"
      className="mt-5 text-center text-[10px] leading-relaxed text-muted-foreground"
    >
      <p>
        Poster artwork via the public{" "}
        <a
          href="https://www.stremio.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          Cinemeta
        </a>{" "}
        catalog. Not endorsed by or affiliated with any rights holder.
      </p>
    </section>
  )
}
