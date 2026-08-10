import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

interface JoinPageProps {
  onJoined?: () => void
}

const redirectHome = () => window.location.replace("/")

export function JoinPage({
  onJoined = redirectHome,
}: JoinPageProps) {
  const token = decodeURIComponent(window.location.hash.slice(1))
  const [state, setState] = useState<"joining" | "error">(
    token ? "joining" : "error",
  )

  useEffect(() => {
    window.history.replaceState(null, "", "/join")

    if (!token) return

    void fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then((response) => {
      if (!response.ok) {
        setState("error")
        return
      }
      onJoined()
    }).catch(() => setState("error"))
  }, [onJoined, token])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center bg-zinc-950 px-6 text-zinc-50">
      <section className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 p-7 text-center shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-400">
          Road to Doomsday
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {state === "joining" ? "Joining your watch route" : "Invite link is incomplete"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {state === "joining"
            ? "Securing this device…"
            : "Ask for a fresh private invite link and try again."}
        </p>
        {state === "error" ? (
          <Button className="mt-6 w-full" onClick={() => window.location.replace("/")}>Home</Button>
        ) : null}
      </section>
    </main>
  )
}
