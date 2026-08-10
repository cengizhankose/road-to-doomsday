import { ArrowLeft, CalendarDays, Check, Clock3, Play, Save, SkipForward } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CatalogItem } from "@/domain/catalog"
import type { ProgressRecord, WatchStatus } from "@/domain/progress"
import { cn } from "@/lib/utils"

interface DetailPageProps {
  item: CatalogItem
  progress?: ProgressRecord
  onSave: (progress: ProgressRecord) => unknown | Promise<unknown>
  saving: boolean
}

const statuses: Array<{
  value: WatchStatus
  label: string
  icon: typeof Clock3
}> = [
  { value: "not_started", label: "Not started", icon: Clock3 },
  { value: "planned", label: "Planned", icon: CalendarDays },
  { value: "watching", label: "Watching", icon: Play },
  { value: "watched", label: "Watched", icon: Check },
  { value: "skipped", label: "Skipped", icon: SkipForward },
]

function ScorePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (value: number) => void
}) {
  return (
    <div role="group" aria-label={`${label} score`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-heading text-lg font-semibold text-primary">
          {value ?? "—"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
          <button
            key={score}
            type="button"
            aria-pressed={value === score}
            onClick={() => onChange(score)}
            className={cn(
              "min-h-10 rounded-md border text-xs font-semibold transition-colors",
              value === score
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/8 bg-white/[0.025] text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DetailPage({ item, progress, onSave, saving }: DetailPageProps) {
  const initial = useMemo<ProgressRecord>(
    () => ({
      catalogId: item.id,
      status: progress?.status ?? "not_started",
      cengizhanScore: progress?.cengizhanScore ?? null,
      sinemScore: progress?.sinemScore ?? null,
      currentSeason: progress?.currentSeason ?? (item.seasonEpisodeCounts ? 1 : null),
      currentEpisode: progress?.currentEpisode ?? (item.seasonEpisodeCounts ? 1 : null),
      plannedAt: progress?.plannedAt ?? null,
      watchedOn: progress?.watchedOn ?? null,
      note: progress?.note ?? "",
      revision: progress?.revision ?? 0,
    }),
    [item, progress],
  )
  const [draft, setDraft] = useState(initial)

  const update = <K extends keyof ProgressRecord>(
    key: K,
    value: ProgressRecord[K],
  ) => setDraft((current) => ({ ...current, [key]: value }))

  const seasonCount = item.seasonEpisodeCounts?.length ?? 0
  const currentSeason = draft.currentSeason ?? 1
  const episodeCount = item.seasonEpisodeCounts?.[currentSeason - 1] ?? 1

  return (
    <main className="px-4 pb-28 pt-4">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to={`/${item.route}`}
          aria-label={`Back to ${item.route} route`}
          className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <Badge variant="outline" className="border-white/10 bg-white/[0.025] uppercase tracking-[0.14em] text-muted-foreground">
          {item.kind}
        </Badge>
      </div>

      <header className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {item.route === "movies" ? "Movie route" : "Series route"} · {item.order}
        </p>
        <h1 className="font-heading text-3xl font-semibold leading-tight tracking-[-0.04em]">
          {item.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {item.year} · {item.releaseStatus === "upcoming" ? "Upcoming" : "Released"}
        </p>
      </header>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave(draft)
        }}
      >
        <Card className="border-white/8 bg-card/70">
          <CardContent>
            <Label className="mb-3 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Status
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {statuses.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={draft.status === value}
                  onClick={() => update("status", value)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors",
                    draft.status === value
                      ? "border-primary/60 bg-primary/12 text-foreground"
                      : "border-white/8 bg-black/15 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {item.seasonEpisodeCounts ? (
          <Card className="border-white/8 bg-card/70">
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="season">Season</Label>
                <Input
                  id="season"
                  type="number"
                  min={1}
                  max={seasonCount}
                  value={currentSeason}
                  onChange={(event) => {
                    const season = Math.min(
                      seasonCount,
                      Math.max(1, Number(event.target.value)),
                    )
                    setDraft((current) => ({
                      ...current,
                      currentSeason: season,
                      currentEpisode: Math.min(
                        current.currentEpisode ?? 1,
                        item.seasonEpisodeCounts?.[season - 1] ?? 1,
                      ),
                    }))
                  }}
                  className="mt-2 min-h-11"
                />
              </div>
              <div>
                <Label htmlFor="episode">Episode</Label>
                <Input
                  id="episode"
                  type="number"
                  min={1}
                  max={episodeCount}
                  value={draft.currentEpisode ?? 1}
                  onChange={(event) =>
                    update(
                      "currentEpisode",
                      Math.min(
                        episodeCount,
                        Math.max(1, Number(event.target.value)),
                      ),
                    )
                  }
                  className="mt-2 min-h-11"
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-white/8 bg-card/70">
          <CardContent className="space-y-5">
            <ScorePicker
              label="Cengizhan"
              value={draft.cengizhanScore ?? null}
              onChange={(value) => update("cengizhanScore", value)}
            />
            <ScorePicker
              label="Sinem"
              value={draft.sinemScore ?? null}
              onChange={(value) => update("sinemScore", value)}
            />
          </CardContent>
        </Card>

        <Card className="border-white/8 bg-card/70">
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="planned-at">Planned date & time</Label>
              <Input
                id="planned-at"
                type="datetime-local"
                value={draft.plannedAt?.slice(0, 16) ?? ""}
                onChange={(event) => update("plannedAt", event.target.value || null)}
                className="mt-2 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="note">Shared note</Label>
              <Textarea
                id="note"
                maxLength={2000}
                value={draft.note ?? ""}
                onChange={(event) => update("note", event.target.value)}
                placeholder="Add a spoiler-free note…"
                className="mt-2 min-h-24"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="min-h-12 w-full shadow-lg shadow-primary/15">
          <Save className="size-4" aria-hidden="true" />
          {saving ? "Saving…" : "Save progress"}
        </Button>
      </form>
    </main>
  )
}
