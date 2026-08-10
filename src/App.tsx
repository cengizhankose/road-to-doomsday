import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { catalog } from "@/data/catalog"
import { useSharedProgress } from "@/hooks/use-shared-progress"
import { queryClient } from "@/lib/query-client"
import { CatalogPage } from "@/pages/catalog-page"
import { DetailPage } from "@/pages/detail-page"
import { HomePage } from "@/pages/home-page"

function DetailRoute({ route }: { route: "movies" | "series" }) {
  const { id } = useParams()
  const shared = useSharedProgress()
  const item = catalog.find((entry) => entry.id === id && entry.route === route)

  if (!item) {
    return <Navigate to={`/${route}`} replace />
  }

  return (
    <DetailPage
      key={item.id}
      item={item}
      progress={shared.progress[item.id]}
      onSave={shared.save}
      saving={shared.saving}
    />
  )
}

function AppRoutes() {
  const shared = useSharedProgress()

  return (
    <AppShell>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              progress={shared.progress}
              onRefresh={() => void shared.refresh()}
              refreshing={shared.refreshing}
            />
          }
        />
        <Route
          path="/movies"
          element={<CatalogPage route="movies" progress={shared.progress} />}
        />
        <Route
          path="/series"
          element={<CatalogPage route="series" progress={shared.progress} />}
        />
        <Route path="/movies/:id" element={<DetailRoute route="movies" />} />
        <Route path="/series/:id" element={<DetailRoute route="series" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
