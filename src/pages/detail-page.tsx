import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  ListStart,
  Play,
  Save,
  SkipForward,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PosterCredit } from "@/components/poster-credit"
import type { CatalogItem } from "@/domain/catalog"
import type { CatalogImage } from "@/domain/images"
import type { ProgressRecord, WatchStatus } from "@/domain/progress"
import { cn } from "@/lib/utils"

interface DetailPageProps {
  item: CatalogItem
  image?: CatalogImage
  progress?: ProgressRecord
  onSave: (progress: ProgressRecord) => unknown | Promise<unknown>
  onSelectNext: (item: CatalogItem) => unknown | Promise<unknown>
  selectedNext: boolean
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

function toLocalDateTimeValue(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toUtcInstant(value: string) {
  return value ? new Date(value).toISOString() : null
}

/** Everything a member can change on this form — `revision` is server-owned. */
type EditableField = Exclude<keyof ProgressRecord, "catalogId" | "revision">

function assign<K extends EditableField>(
  target: ProgressRecord,
  key: K,
  value: ProgressRecord[K]
) {
  target[key] = value
}

function isEqual(left: unknown, right: unknown) {
  return (left ?? null) === (right ?? null)
}

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
                : "border-white/8 bg-white/[0.025] text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DetailPage({
  item,
  image,
  progress,
  onSave,
  onSelectNext,
  selectedNext,
  saving,
}: DetailPageProps) {
  const initial = useMemo<ProgressRecord>(
    () => ({
      catalogId: item.id,
      status: progress?.status ?? "not_started",
      cengizhanScore: progress?.cengizhanScore ?? null,
      sinemScore: progress?.sinemScore ?? null,
      currentSeason:
        progress?.currentSeason ?? (item.seasonEpisodeCounts ? 1 : null),
      currentEpisode:
        progress?.currentEpisode ?? (item.seasonEpisodeCounts ? 1 : null),
      plannedAt: progress?.plannedAt ?? null,
      watchedOn: progress?.watchedOn ?? null,
      note: progress?.note ?? "",
      revision: progress?.revision ?? 0,
    }),
    [item, progress]
  )
  const [draft, setDraft] = useState(initial)
  const [edited, setEdited] = useState<ReadonlySet<EditableField>>(
    () => new Set()
  )

  /*
   * The shared revision advances for two very different reasons, and the form
   * must not treat them the same way.
   *
   * After this device's own save, adopting the new revision is all that is
   * needed — the server already holds exactly these values.
   *
   * After the *other* member's save, adopting the revision alone would arm a
   * silent lost update: the next save would carry this form's stale values at
   * a revision the server accepts, wiping whatever they wrote. So the incoming
   * record is merged field by field, and only fields this member actually
   * edited keep the local value. Everything untouched takes the other
   * device's value and becomes visible on screen.
   */
  const [syncedRevision, setSyncedRevision] = useState(initial.revision)
  if (initial.revision !== syncedRevision) {
    setSyncedRevision(initial.revision)
    setDraft((current) => {
      const merged = { ...initial }
      for (const field of edited) assign(merged, field, current[field])
      return merged
    })
    // Once the server agrees with every local edit there is nothing left to
    // protect, so later foreign changes are free to flow in.
    if ([...edited].every((field) => isEqual(initial[field], draft[field]))) {
      setEdited(new Set())
    }
  }

  const update = <K extends EditableField>(
    key: K,
    value: ProgressRecord[K]
  ) => {
    setEdited((current) =>
      current.has(key) ? current : new Set(current).add(key)
    )
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const seasonCount = item.seasonEpisodeCounts?.length ?? 0
  const currentSeason = draft.currentSeason ?? 1
  const episodeCount = item.seasonEpisodeCounts?.[currentSeason - 1] ?? 1

  return (
    <main className="px-4 pt-4 pb-28">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to={`/${item.route}`}
          aria-label={`Back to ${item.route} route`}
          className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <Badge
          variant="outline"
          className="border-white/10 bg-white/[0.025] tracking-[0.14em] text-muted-foreground uppercase"
        >
          {item.kind}
        </Badge>
      </div>

      <header className="mb-6 flex items-end gap-4">
        {image ? (
          <img
            src={image.imageUri}
            alt={`${item.title} poster`}
            className="h-36 w-24 shrink-0 rounded-md object-cover shadow-xl ring-1 shadow-black/35 ring-white/10"
          />
        ) : null}
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {item.route === "movies" ? "Movie route" : "Series route"} ·{" "}
            {item.order}
          </p>
          <h1 className="font-heading text-3xl leading-tight font-semibold tracking-[-0.04em]">
            {item.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {item.year} ·{" "}
            {item.releaseStatus === "upcoming" ? "Upcoming" : "Released"}
          </p>
        </div>
      </header>

      <Button
        type="button"
        variant={selectedNext ? "secondary" : "outline"}
        aria-pressed={selectedNext}
        disabled={saving || selectedNext}
        onClick={() => void onSelectNext(item)}
        className="mb-4 min-h-12 w-full border-primary/30"
      >
        <ListStart className="size-4" aria-hidden="true" />
        {selectedNext ? "Selected as next" : "Set as next"}
      </Button>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave(draft)
        }}
      >
        <Card className="border-white/8 bg-card/70">
          <CardContent>
            <Label className="mb-3 block text-xs tracking-[0.15em] text-muted-foreground uppercase">
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
                      : "border-white/8 bg-black/15 text-muted-foreground hover:text-foreground"
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
                      Math.max(1, Number(event.target.value))
                    )
                    setEdited((current) =>
                      new Set(current).add("currentSeason").add("currentEpisode")
                    )
                    setDraft((current) => ({
                      ...current,
                      currentSeason: season,
                      currentEpisode: Math.min(
                        current.currentEpisode ?? 1,
                        item.seasonEpisodeCounts?.[season - 1] ?? 1
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
                        Math.max(1, Number(event.target.value))
                      )
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
                value={toLocalDateTimeValue(draft.plannedAt)}
                onChange={(event) =>
                  update("plannedAt", toUtcInstant(event.target.value))
                }
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

        <Button
          type="submit"
          disabled={saving}
          className="min-h-12 w-full shadow-lg shadow-primary/15"
        >
          <Save className="size-4" aria-hidden="true" />
          {saving ? "Saving…" : "Save progress"}
        </Button>
      </form>

      {image ? (
        <PosterCredit />
      ) : null}
    </main>
  )
}
