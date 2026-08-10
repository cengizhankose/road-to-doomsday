import { ArrowLeft, Check, ChevronRight, Clock3, Play, SkipForward } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getRouteItems } from "@/data/catalog"
import type { Route } from "@/domain/catalog"
import {
  getRouteCompletion,
  type ProgressMap,
  type WatchStatus,
} from "@/domain/progress"
import { catalog } from "@/data/catalog"

interface CatalogPageProps {
  route: Route
  progress: ProgressMap
}

const statusMeta: Record<WatchStatus, { label: string; icon: typeof Clock3 }> = {
  not_started: { label: "Not started", icon: Clock3 },
  planned: { label: "Planned", icon: Clock3 },
  watching: { label: "Watching", icon: Play },
  watched: { label: "Watched", icon: Check },
  skipped: { label: "Skipped", icon: SkipForward },
}

export function CatalogPage({ route, progress }: CatalogPageProps) {
  const items = getRouteItems(route)
  const completion = getRouteCompletion(catalog, progress, route)
  const title = route === "movies" ? "Movie Route" : "Series Route"

  return (
    <main className="px-4 pb-28 pt-4">
      <header className="mb-6">
        <Link
          to="/"
          aria-label="Back to dashboard"
          className="mb-5 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Independent path
        </p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
            {title}
          </h1>
          <span className="font-heading text-lg font-semibold text-primary">
            {completion.percent}%
          </span>
        </div>
        <Progress value={completion.percent} className="mt-4 h-1.5 bg-white/8" />
        <p className="mt-2 text-xs text-muted-foreground">
          {completion.watched} watched · {completion.total} total
        </p>
      </header>

      <ol className="space-y-2" aria-label={`${title} titles`}>
        {items.map((item) => {
          const current = progress[item.id]
          const status = current?.status ?? "not_started"
          const { label, icon: StatusIcon } = statusMeta[status]

          return (
            <li key={item.id}>
              <Link
                to={`/${route}/${item.id}`}
                className="group flex min-h-20 items-center gap-3 rounded-md border border-white/7 bg-card/55 p-3 transition-colors hover:border-primary/30 hover:bg-card/80"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-black/25 font-heading text-xs font-semibold text-muted-foreground ring-1 ring-white/6">
                  {String(item.order).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-sm font-semibold">
                    {item.title}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusIcon
                      className={status === "watched" ? "size-3 text-emerald-500" : "size-3"}
                      aria-hidden="true"
                    />
                    {label}
                    <span aria-hidden="true">·</span>
                    {item.year}
                  </span>
                </span>
                {item.releaseStatus === "upcoming" ? (
                  <Badge variant="outline" className="border-primary/25 text-[9px] uppercase text-primary">
                    Soon
                  </Badge>
                ) : null}
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
