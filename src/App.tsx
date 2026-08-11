import { QueryClientProvider } from "@tanstack/react-query"
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { ActionErrorNotice } from "@/components/action-error-notice"
import { PrivateAccessGate } from "@/components/private-access-gate"
import { catalog } from "@/data/catalog"
import { shouldNotifyPlan } from "@/domain/progress"
import { useSharedProgress } from "@/hooks/use-shared-progress"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { queryClient } from "@/lib/query-client"
import { CatalogPage } from "@/pages/catalog-page"
import { DetailPage } from "@/pages/detail-page"
import { HomePage } from "@/pages/home-page"
import { JoinPage } from "@/pages/join-page"

type SharedProgress = ReturnType<typeof useSharedProgress>

// The whole app reads one `useSharedProgress` instance. A second instance would
// have its own mutation state, so a save that failed on the detail page would
// never reach the notice rendered above the routes.
function DetailRoute({
  route,
  shared,
}: {
  route: "movies" | "series"
  shared: SharedProgress
}) {
  const { id } = useParams()
  const item = catalog.find((entry) => entry.id === id && entry.route === route)

  if (!item) {
    return <Navigate to={`/${route}`} replace />
  }

  return (
    <DetailPage
      key={item.id}
      item={item}
      image={shared.images[item.id]}
      progress={shared.progress[item.id]}
      members={shared.members}
      onSave={(next) =>
        shouldNotifyPlan(shared.progress[item.id], next)
          ? shared.schedule(next)
          : shared.save(next)
      }
      onSelectNext={(selected) =>
        shared.selectNext({ route: selected.route, catalogId: selected.id })
      }
      selectedNext={shared.selections[item.route] === item.id}
      saving={shared.saving}
    />
  )
}

function AppRoutes() {
  const shared = useSharedProgress()
  const notifications = usePushNotifications(
    shared.pushPublicKey,
    shared.member.id,
    shared.pushBindingId,
  )

  return (
    <PrivateAccessGate loading={shared.loading} error={shared.error}>
      <AppShell>
        <ActionErrorNotice
          error={shared.actionError}
          onRetry={() => {
            shared.dismissActionError()
            void shared.refresh()
          }}
          onDismiss={shared.dismissActionError}
        />
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                progress={shared.progress}
                selections={shared.selections}
                onRefresh={() => void shared.refresh()}
                refreshing={shared.refreshing}
                // Same gate the detail page uses: only a new or changed plan
                // is worth waking the other member for.
                onSchedule={(record) =>
                  shouldNotifyPlan(shared.progress[record.catalogId], record)
                    ? shared.schedule(record)
                    : shared.save(record)
                }
                scheduling={shared.saving}
                notification={{
                  memberName: shared.member.name,
                  supported: notifications.supported,
                  subscribed: notifications.subscribed,
                  enabling: notifications.enabling,
                  blocked: notifications.blocked,
                  error: notifications.error,
                  // `enable` reports failure through its own state, so there is
                  // no rejection for this click handler to drop.
                  onEnable: () => void notifications.enable(),
                }}
              />
            }
          />
          <Route
            path="/movies"
            element={
              <CatalogPage
                route="movies"
                progress={shared.progress}
                images={shared.images}
              />
            }
          />
          <Route
            path="/series"
            element={
              <CatalogPage
                route="series"
                progress={shared.progress}
                images={shared.images}
              />
            }
          />
          <Route
            path="/movies/:id"
            element={<DetailRoute route="movies" shared={shared} />}
          />
          <Route
            path="/series/:id"
            element={<DetailRoute route="series" shared={shared} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </PrivateAccessGate>
  )
}

function RouterRoutes() {
  return (
    <Routes>
      <Route path="/join" element={<JoinPage />} />
      <Route path="*" element={<AppRoutes />} />
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouterRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
