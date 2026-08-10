import { ArrowUpRight, Clapperboard, Tv } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { CatalogItem, Route } from "@/domain/catalog"
import { ProgressRing } from "@/components/progress-ring"

interface RouteCardProps {
  route: Route
  nextItem?: CatalogItem
  watched: number
  total: number
  percent: number
}

export function RouteCard({
  route,
  nextItem,
  watched,
  total,
  percent,
}: RouteCardProps) {
  const isMovies = route === "movies"
  const label = isMovies ? "Movie Route" : "Series Route"
  const Icon = isMovies ? Clapperboard : Tv

  return (
    <Card className="overflow-hidden border-white/8 bg-card/70 py-0 shadow-xl shadow-black/20 backdrop-blur-xl">
      <CardContent className="p-4">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-md bg-primary/12 text-primary">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-sm font-semibold tracking-tight">{label}</p>
              <p className="text-xs text-muted-foreground">
                {watched} of {total} complete
              </p>
            </div>
          </div>
          <ProgressRing value={percent} label={`${label} ${percent}% complete`} />
        </div>

        <div className="rounded-md border border-white/6 bg-black/25 p-3.5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Badge variant="outline" className="border-primary/25 bg-primary/8 text-[10px] uppercase tracking-[0.15em] text-primary">
              Next up
            </Badge>
            {nextItem ? (
              <span className="text-xs text-muted-foreground">{nextItem.year}</span>
            ) : null}
          </div>
          <p className="min-h-12 font-heading text-lg font-semibold leading-tight">
            {nextItem?.title ?? "Route complete"}
          </p>
          <Link
            to={`/${route}`}
            aria-label={`Open ${isMovies ? "movie" : "series"} route`}
            className="mt-3 flex min-h-11 items-center justify-between border-t border-white/6 pt-3 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            View route
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
