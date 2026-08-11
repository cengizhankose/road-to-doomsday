import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import type {
  HouseholdMember,
  ProgressRecord,
  SharedProgressState,
} from "@/domain/progress"
import {
  conflictRecord,
  progressClient,
  type Selection,
} from "@/lib/progress-client"

const queryKey = ["shared-progress"] as const
const localStorageKey = "rtd-dev-progress"

// Development runs against localStorage rather than a household, so it needs
// stand-in members. Production always replaces these with the real rows.
const devMembers: HouseholdMember[] = [
  { id: "local-member-1", name: "Member 1", slot: 1 },
  { id: "local-member-2", name: "Member 2", slot: 2 },
]

const emptyState: SharedProgressState = {
  progress: {},
  selections: { movies: null, series: null },
  images: {},
  member: { id: devMembers[0].id, name: devMembers[0].name },
  members: devMembers,
  pushPublicKey: null,
  pushBindingId: "local",
}

function readLocalState(): SharedProgressState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(localStorageKey) ?? "{}"
    ) as Record<string, unknown>
    if (parsed.progress && parsed.selections) {
      return {
        ...(parsed as unknown as SharedProgressState),
        images: (parsed.images ?? {}) as SharedProgressState["images"],
        member: (parsed.member ??
          emptyState.member) as SharedProgressState["member"],
        members: (parsed.members ??
          emptyState.members) as SharedProgressState["members"],
        pushPublicKey: (parsed.pushPublicKey ?? null) as string | null,
        pushBindingId: (parsed.pushBindingId ?? "local") as string,
      }
    }
    return {
      ...emptyState,
      progress: parsed as SharedProgressState["progress"],
    }
  } catch {
    return emptyState
  }
}

function writeLocalState(state: SharedProgressState) {
  localStorage.setItem(localStorageKey, JSON.stringify(state))
}

function saveLocalProgress(record: ProgressRecord): ProgressRecord {
  const current = readLocalState()
  const saved = {
    ...record,
    revision: (current.progress[record.catalogId]?.revision ?? 0) + 1,
  }
  writeLocalState({
    ...current,
    progress: { ...current.progress, [record.catalogId]: saved },
  })
  return saved
}

function saveLocalSelection(selection: Selection): Selection {
  const current = readLocalState()
  writeLocalState({
    ...current,
    selections: {
      ...current.selections,
      [selection.route]: selection.catalogId,
    },
  })
  return selection
}

export function useSharedProgress() {
  const queryClient = useQueryClient()
  // Counts accepted explicit saves. A count rather than a flag: the UI reacts
  // to it changing, so two saves in a row are two distinct confirmations and a
  // re-render is none.
  const [saveSuccessToken, setSaveSuccessToken] = useState(0)

  const cacheRecord = (saved: ProgressRecord) => {
    queryClient.setQueryData<SharedProgressState>(
      queryKey,
      (current = emptyState) => ({
        ...current,
        progress: { ...current.progress, [saved.catalogId]: saved },
      })
    )
  }

  // A 409 means another device won the race and the response carries the row
  // that actually won. Writing it into the cache is what lets the open form
  // show those values and recover, instead of retrying a doomed revision.
  const cacheConflict = (error: unknown) => {
    const current = conflictRecord(error)
    if (current) cacheRecord(current)
  }
  const query = useQuery({
    queryKey,
    queryFn: () =>
      import.meta.env.DEV
        ? Promise.resolve(readLocalState())
        : progressClient.getAll(),
  })
  const progressMutation = useMutation({
    mutationFn: (record: ProgressRecord) =>
      import.meta.env.DEV
        ? Promise.resolve(saveLocalProgress(record))
        : progressClient.save(record),
    // Only this mutation advances the token. A schedule is its own action with
    // its own feedback, and a refetch is not a save at all.
    onSuccess: (saved) => {
      cacheRecord(saved)
      setSaveSuccessToken((count) => count + 1)
    },
    onError: cacheConflict,
  })
  const scheduleMutation = useMutation({
    mutationFn: (record: ProgressRecord) =>
      import.meta.env.DEV
        ? Promise.resolve(saveLocalProgress(record))
        : progressClient.schedule(record),
    onSuccess: cacheRecord,
    onError: cacheConflict,
  })
  const selectionMutation = useMutation({
    mutationFn: (selection: Selection) =>
      import.meta.env.DEV
        ? Promise.resolve(saveLocalSelection(selection))
        : progressClient.saveSelection(selection),
    onSuccess: (saved) => {
      queryClient.setQueryData<SharedProgressState>(
        queryKey,
        (current = emptyState) => ({
          ...current,
          selections: { ...current.selections, [saved.route]: saved.catalogId },
        })
      )
    },
  })

  const state = query.data ?? emptyState
  return {
    progress: state.progress,
    selections: state.selections,
    images: state.images,
    member: state.member,
    members: state.members,
    pushPublicKey: state.pushPublicKey,
    pushBindingId: state.pushBindingId,
    loading: query.isLoading,
    refreshing: query.isFetching,
    refresh: query.refetch,
    // `mutate`, not `mutateAsync`: every caller is fire-and-forget, and a
    // rejected promise nobody awaits becomes an unhandled rejection instead of
    // the inline notice these failures are supposed to produce.
    save: progressMutation.mutate,
    /** Advances once per accepted explicit save; drives the save confirmation. */
    saveSuccessToken,
    schedule: scheduleMutation.mutate,
    selectNext: selectionMutation.mutate,
    saving:
      progressMutation.isPending ||
      scheduleMutation.isPending ||
      selectionMutation.isPending,
    // Only the initial query error can lock the app. Mutation failures stay
    // separate so a rejected save never hides progress already on screen.
    error: query.error,
    actionError:
      progressMutation.error ||
      scheduleMutation.error ||
      selectionMutation.error ||
      null,
    dismissActionError: () => {
      progressMutation.reset()
      scheduleMutation.reset()
      selectionMutation.reset()
    },
  }
}
