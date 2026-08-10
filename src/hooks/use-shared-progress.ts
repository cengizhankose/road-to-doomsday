import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { ProgressMap, ProgressRecord } from "@/domain/progress"
import { progressClient } from "@/lib/progress-client"

const queryKey = ["shared-progress"] as const
const localStorageKey = "rtd-dev-progress"

function readLocalProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(localStorageKey) ?? "{}") as ProgressMap
  } catch {
    return {}
  }
}

function saveLocalProgress(record: ProgressRecord): ProgressRecord {
  const current = readLocalProgress()
  const saved = { ...record, revision: (current[record.catalogId]?.revision ?? 0) + 1 }
  localStorage.setItem(
    localStorageKey,
    JSON.stringify({ ...current, [record.catalogId]: saved }),
  )
  return saved
}

export function useSharedProgress() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey,
    queryFn: () =>
      import.meta.env.DEV
        ? Promise.resolve(readLocalProgress())
        : progressClient.getAll(),
  })
  const mutation = useMutation({
    mutationFn: (record: ProgressRecord) =>
      import.meta.env.DEV
        ? Promise.resolve(saveLocalProgress(record))
        : progressClient.save(record),
    onSuccess: (saved) => {
      queryClient.setQueryData<ProgressMap>(queryKey, (current = {}) => ({
        ...current,
        [saved.catalogId]: saved,
      }))
    },
  })

  return {
    progress: query.data ?? {},
    loading: query.isLoading,
    refreshing: query.isFetching,
    refresh: query.refetch,
    save: mutation.mutateAsync,
    saving: mutation.isPending,
    error: query.error ?? mutation.error,
  }
}
