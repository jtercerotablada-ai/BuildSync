"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useEffect } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, type ToasterProps } from "sonner"

// When the last Toaster unmounted; tells a group hop from a later return.
let toasterUnmountedAt = 0

const Toaster = ({ ...props }: ToasterProps) => {
  // `theme` is the STORED preference, which can be "system" even while the
  // app is forced light; following it would give dark-theme toast text on
  // our light popover background. Use the theme actually applied.
  const { forcedTheme, resolvedTheme } = useTheme()
  const theme = forcedTheme ?? resolvedTheme ?? "light"

  // This Toaster lives in SaasShell, once per SaaS route group, so a hop
  // between groups (/teams/new → /teams/<id>) swaps it for a fresh, empty
  // one and a toast fired just before the hop ("Team created") vanished.
  // sonner's store still holds it as live — it is only marked done when a
  // Toaster removes it — so hand those over. Re-creating an existing id
  // updates it in place: nothing is duplicated. Only across a hop, though:
  // after a stretch with no Toaster (an error screen, a 404, the public
  // site) those toasts are stale, so they are retired instead of replayed.
  useEffect(() => {
    const isHop = Date.now() - toasterUnmountedAt < 1000
    for (const t of toast.getToasts()) {
      if ("dismiss" in t) continue // type guard; the store holds none
      if (isHop) toast.message(t.title, { id: t.id })
      else toast.dismiss(t.id)
    }
    return () => {
      toasterUnmountedAt = Date.now()
    }
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
