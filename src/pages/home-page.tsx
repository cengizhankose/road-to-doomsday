import { RefreshCw, ShieldCheck } from "lucide-react"

import { NotificationPrompt } from "@/components/notification-prompt"
import { MiniCalendar } from "@/components/mini-calendar"
import { RouteCard } from "@/components/route-card"
import { Button } from "@/components/ui/button"
import { catalog } from "@/data/catalog"
import {
  getRouteCompletion,
  getSelectedRouteItem,
  type ProgressMap,
  type ProgressRecord,
  type RouteSelections,
} from "@/domain/progress"

interface HomePageProps {
  progress: ProgressMap
  selections: RouteSelections
  onRefresh: () => void
  refreshing: boolean
  onSchedule?: (record: ProgressRecord) => unknown | Promise<unknown>
  scheduling?: boolean
  notification?: {
    memberName: string
    supported: boolean
    subscribed: boolean
    enabling: boolean
    onEnable: () => void
    error?: unknown
    blocked?: boolean
  }
}

export function HomePage({
  progress,
  selections,
  onRefresh,
  refreshing,
  onSchedule,
  scheduling = false,
  notification,
}: HomePageProps) {
  const movies = getRouteCompletion(catalog, progress, "movies")
  const series = getRouteCompletion(catalog, progress, "series")

  return (
    <main className="px-4 pt-5 pb-28">
      <header className="mb-7">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-sm bg-primary font-heading text-xs font-bold text-primary-foreground shadow-[0_0_24px_rgba(185,28,28,0.25)]">
              RTD
            </span>
            <span className="font-heading text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Shared watchlist
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh shared progress"
            onClick={onRefresh}
            disabled={refreshing}
            className="size-11 rounded-full text-muted-foreground"
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </Button>
        </div>

        <p className="mb-2 text-[11px] font-semibold tracking-[0.24em] text-primary uppercase">
          The journey continues
        </p>
        <h1
          aria-label="Road to Doomsday"
          className="font-heading text-4xl leading-[0.92] font-semibold tracking-[-0.05em]"
        >
          Road to
          <br />
          <span className="text-primary">Doomsday</span>
        </h1>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Two paths. One destination. Pick tonight&apos;s route and keep the
          shared progress moving.
        </p>
      </header>

      <section aria-label="Watch routes" className="space-y-3.5">
        <RouteCard
          route="movies"
          nextItem={getSelectedRouteItem(catalog, selections, "movies")}
          {...movies}
        />
        <RouteCard
          route="series"
          nextItem={getSelectedRouteItem(catalog, selections, "series")}
          {...series}
        />
      </section>

      {onSchedule ? (
        <div className="mt-4">
          <MiniCalendar
            items={catalog}
            progress={progress}
            onSchedule={onSchedule}
            saving={scheduling}
          />
        </div>
      ) : null}

      {notification ? (
        <div className="mt-4">
          <NotificationPrompt {...notification} />
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden="true" />
        Progress is shared only through your private link.
      </div>
    </main>
  )
}
