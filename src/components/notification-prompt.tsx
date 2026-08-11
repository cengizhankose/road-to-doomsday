import { Bell, BellRing } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface NotificationPromptProps {
  memberName: string
  supported: boolean
  subscribed: boolean
  enabling: boolean
  onEnable: () => void
  error?: unknown
  blocked?: boolean
}

export function NotificationPrompt({
  memberName,
  supported,
  subscribed,
  enabling,
  onEnable,
  error = null,
  blocked = false,
}: NotificationPromptProps) {
  if (!supported) return null

  return (
    <Card className="border-white/8 bg-card/55 py-0">
      <CardContent className="space-y-3 p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {subscribed ? (
              <BellRing className="size-4" aria-hidden="true" />
            ) : (
              <Bell className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{memberName}&apos;s device</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {subscribed
                ? "Notifications on"
                : "Get notified when the other person plans a title."}
            </p>
          </div>
          {!subscribed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={enabling}
              onClick={onEnable}
              className="shrink-0 border-primary/25"
            >
              {enabling ? "Enabling…" : "Enable notifications"}
            </Button>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-200"
          >
            Couldn&apos;t turn on notifications on this device.
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={enabling}
              onClick={onEnable}
              className="h-auto p-0 text-xs text-amber-200"
            >
              Try again
            </Button>
          </p>
        ) : blocked ? (
          <p role="alert" className="text-xs text-muted-foreground">
            This browser blocked notifications for this site. Allow them in the
            site settings, then enable again.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
