import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
  ProgressRecord,
  SharedProgressState,
} from "@/domain/progress"
import {
  progressClient,
  type Selection,
} from "@/lib/progress-client"

const queryKey = ["shared-progress"] as const
const localStorageKey = "rtd-dev-progress"
const emptyState: SharedProgressState = {
  progress: {},
  selections: { movies: null, series: null },
}

function readLocalState(): SharedProgressState {
  try {
    const parsed = JSON.parse(localStorage.getItem(localStorageKey) ?? "{}") as Record<string, unknown>
    if (parsed.progress && parsed.selections) {
      return parsed as unknown as SharedProgressState
    }
    return { ...emptyState, progress: parsed as SharedProgressState["progress"] }
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
    selections: { ...current.selections, [selection.route]: selection.catalogId },
  })
  return selection
}

export function useSharedProgress() {
  const queryClient = useQueryClient()
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
    onSuccess: (saved) => {
      queryClient.setQueryData<SharedProgressState>(queryKey, (current = emptyState) => ({
        ...current,
        progress: { ...current.progress, [saved.catalogId]: saved },
      }))
    },
  })
  const selectionMutation = useMutation({
    mutationFn: (selection: Selection) =>
      import.meta.env.DEV
        ? Promise.resolve(saveLocalSelection(selection))
        : progressClient.saveSelection(selection),
    onSuccess: (saved) => {
      queryClient.setQueryData<SharedProgressState>(queryKey, (current = emptyState) => ({
        ...current,
        selections: { ...current.selections, [saved.route]: saved.catalogId },
      }))
    },
  })

  const state = query.data ?? emptyState
  return {
    progress: state.progress,
    selections: state.selections,
    loading: query.isLoading,
    refreshing: query.isFetching,
    refresh: query.refetch,
    save: progressMutation.mutateAsync,
    selectNext: selectionMutation.mutateAsync,
    saving: progressMutation.isPending || selectionMutation.isPending,
    error: query.error ?? progressMutation.error ?? selectionMutation.error,
  }
}
