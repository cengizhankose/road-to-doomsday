import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import type { CatalogItem } from "@/domain/catalog"
import type { ProgressMap, ProgressRecord } from "@/domain/progress"
import { cn } from "@/lib/utils"

interface MiniCalendarProps {
  items: CatalogItem[]
  progress: ProgressMap
  onSchedule: (record: ProgressRecord) => unknown | Promise<unknown>
  saving: boolean
  now?: Date
}

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function sameDay(left: Date, right: Date) {
  return dateKey(left) === dateKey(right)
}

function monthDays(month: Date) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekDay = new Date(year, monthIndex, 1).getDay()
  const count = new Date(year, monthIndex + 1, 0).getDate()
  const cells: Array<Date | null> = Array.from(
    { length: firstWeekDay },
    () => null
  )

  for (let day = 1; day <= count; day += 1) {
    cells.push(new Date(year, monthIndex, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

export function MiniCalendar({
  items,
  progress,
  onSchedule,
  saving,
  now = new Date(),
}: MiniCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  )
  const [selectedDay, setSelectedDay] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate())
  )
  const [catalogId, setCatalogId] = useState(items[0]?.id ?? "")
  const [time, setTime] = useState("19:00")

  const plansByDay = useMemo(() => {
    const plans = new Map<string, ProgressRecord[]>()
    Object.values(progress).forEach((record) => {
      // `plannedAt` is kept for history once a title is watched or skipped, so
      // the status is what decides whether a plan is still live.
      if (record.status !== "planned" || !record.plannedAt) return
      const plannedDate = new Date(record.plannedAt)
      if (Number.isNaN(plannedDate.getTime())) return
      const key = dateKey(plannedDate)
      plans.set(key, [...(plans.get(key) ?? []), record])
    })
    return plans
  }, [progress])

  const selectedPlans = plansByDay.get(dateKey(selectedDay)) ?? []
  const titleById = new Map(items.map((item) => [item.id, item.title]))
  const monthLabel = visibleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
  const selectedLabel = selectedDay.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  })

  const changeMonth = (offset: number) => {
    const target = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1
    )
    setVisibleMonth(target)
    setSelectedDay(target)
  }

  return (
    <section className="rounded-xl border border-white/8 bg-card/70 p-3 shadow-lg shadow-black/15">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => changeMonth(-1)}
          className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <h2 className="font-heading text-base font-semibold">{monthLabel}</h2>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => changeMonth(1)}
          className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div
        className="grid grid-cols-7 gap-1"
        role="grid"
        aria-label={monthLabel}
      >
        {weekDays.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="pb-1 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {day}
          </div>
        ))}
        {monthDays(visibleMonth).map((day, index) => {
          if (!day) return <div key={`empty-${index}`} aria-hidden="true" />

          const plans = plansByDay.get(dateKey(day)) ?? []
          const longLabel = day.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
          const ariaLabel = plans.length
            ? `${longLabel}, ${plans.length} planned ${plans.length === 1 ? "item" : "items"}`
            : longLabel

          return (
            <button
              key={dateKey(day)}
              type="button"
              aria-label={ariaLabel}
              aria-pressed={sameDay(day, selectedDay)}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "relative flex aspect-square min-h-9 items-center justify-center rounded-md text-xs transition-colors",
                sameDay(day, selectedDay)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-white/5"
              )}
            >
              {day.getDate()}
              {plans.length > 0 ? (
                <span
                  data-testid="planned-dot"
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-1 size-1 rounded-full",
                    sameDay(day, selectedDay)
                      ? "bg-primary-foreground"
                      : "bg-primary"
                  )}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      {selectedPlans.length > 0 ? (
        <div
          role="region"
          aria-label="Selected day plans"
          className="mt-3 border-t border-white/8 pt-3"
        >
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Planned for {selectedLabel}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {selectedPlans.map((record) => (
              <li key={record.catalogId} className="text-sm font-medium">
                {titleById.get(record.catalogId) ?? record.catalogId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="mt-3 grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2 border-t border-white/8 pt-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!catalogId || !time) return
          const existing = progress[catalogId]
          void onSchedule({
            ...(existing ?? { catalogId, revision: 0 }),
            status: "planned",
            plannedAt: new Date(
              `${dateKey(selectedDay)}T${time}:00`
            ).toISOString(),
          })
        }}
      >
        <label className="text-xs font-medium text-muted-foreground">
          Title
          <select
            value={catalogId}
            onChange={(event) => setCatalogId(event.target.value)}
            disabled={saving || items.length === 0}
            className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Time
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            disabled={saving}
            required
            className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={saving || items.length === 0 || !time}
          className="col-span-2 min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Schedule"}
        </button>
      </form>
    </section>
  )
}
