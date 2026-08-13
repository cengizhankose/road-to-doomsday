/**
 * Browser-local demo state served to anonymous visitors on the public URL.
 *
 * The stable alias is intentionally private per household — the real tracker
 * lives behind a session cookie — but a curious visitor should still see what
 * the app *is* rather than a locked door. This module hosts a fully local
 * fallback: seeded from a small illustrative catalog picks, stored under a
 * demo-only localStorage key, and mutated in place. Nothing here ever talks
 * to the API, so there is no way a demo edit can leak into real household
 * data even if a mutation was mis-wired to it.
 */
import type {
  HouseholdMember,
  ProgressMap,
  ProgressRecord,
  RouteSelections,
  SharedProgressState,
} from "@/domain/progress"
import type { Selection } from "@/lib/progress-client"

/**
 * Namespaced so it never collides with the dev-mode key. A demo visitor who
 * later opens a real invite would have this row sitting alongside the invited
 * session's real state, and neither should be able to read the other.
 */
export const DEMO_STORAGE_KEY = "rtd-demo-progress"

const DEMO_MEMBERS: HouseholdMember[] = [
  { id: "demo-you", name: "You", slot: 1 },
  { id: "demo-friend", name: "A friend", slot: 2 },
]

const initialProgress: ProgressMap = {
  "iron-man": {
    catalogId: "iron-man",
    status: "watched",
    memberOneScore: 9,
    memberTwoScore: 8,
    revision: 1,
  },
  "the-incredible-hulk": {
    catalogId: "the-incredible-hulk",
    status: "watched",
    memberOneScore: 6,
    memberTwoScore: 6,
    revision: 1,
  },
  "iron-man-2": {
    catalogId: "iron-man-2",
    status: "watched",
    memberOneScore: 7,
    memberTwoScore: 7,
    revision: 1,
  },
  thor: {
    catalogId: "thor",
    status: "watching",
    revision: 1,
  },
  daredevil: {
    catalogId: "daredevil",
    status: "watched",
    memberOneScore: 9,
    memberTwoScore: 9,
    revision: 1,
  },
}

const initialSelections: RouteSelections = {
  movies: "thor",
  series: "wandavision",
}

function initialDemoState(): SharedProgressState {
  return {
    progress: { ...initialProgress },
    selections: { ...initialSelections },
    images: {},
    member: { id: DEMO_MEMBERS[0].id, name: DEMO_MEMBERS[0].name },
    members: [...DEMO_MEMBERS],
    pushPublicKey: null,
    pushBindingId: "demo",
  }
}

function hasStructure(value: unknown): value is Partial<SharedProgressState> {
  return typeof value === "object" && value !== null
}

/**
 * Read the demo state from localStorage, seeding a fresh copy the first time.
 * Any parse failure or missing-key case returns the seed rather than throwing,
 * because a demo visitor should never see an error screen — the whole point is
 * that this path is reachable without any credentials.
 */
export function readDemoState(): SharedProgressState {
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (
        hasStructure(parsed) &&
        parsed.progress &&
        parsed.selections &&
        parsed.member &&
        parsed.members
      ) {
        return {
          progress: parsed.progress as ProgressMap,
          selections: parsed.selections as RouteSelections,
          images: (parsed.images ?? {}) as SharedProgressState["images"],
          member: parsed.member as SharedProgressState["member"],
          members: parsed.members as HouseholdMember[],
          pushPublicKey: null,
          pushBindingId: "demo",
        }
      }
    }
  } catch {
    // Fall through to the seed — parse failures should never gate the demo.
  }
  const seed = initialDemoState()
  writeDemoState(seed)
  return seed
}

function writeDemoState(state: SharedProgressState): void {
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage quota or a privacy-mode block should not crash the demo — the
    // in-memory state carried by React Query keeps the session working, it
    // just will not survive a reload. That is the correct degraded behavior.
  }
}

export function saveDemoProgress(record: ProgressRecord): ProgressRecord {
  const current = readDemoState()
  const saved: ProgressRecord = {
    ...record,
    revision: (current.progress[record.catalogId]?.revision ?? 0) + 1,
  }
  writeDemoState({
    ...current,
    progress: { ...current.progress, [record.catalogId]: saved },
  })
  return saved
}

export function saveDemoSelection(selection: Selection): Selection {
  const current = readDemoState()
  writeDemoState({
    ...current,
    selections: {
      ...current.selections,
      [selection.route]: selection.catalogId,
    },
  })
  return selection
}
