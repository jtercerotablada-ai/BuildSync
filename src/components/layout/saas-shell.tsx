import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "@/components/providers/session-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AIPanelProvider } from "@/contexts/ai-panel-context";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";

/* Everything the authenticated app needs and the public site must not ship:
   Tailwind + shadcn (globals.css), Inter, the next-auth session, React Query,
   the AI panel state and the toaster. The root layout is a bare <html><body>
   so the marketing pages under (public) load only mp.css. Every SaaS layout
   wraps its tree in this — the (auth), (dashboard), (fullpage) and (portal)
   groups plus forms/, invite/, maintenance/ and onboarding/.

   One consequence: the groups are siblings, so crossing from one to another
   (say /teams/new in (fullpage) to /teams/<id> in (dashboard)) remounts these
   providers. QueryProvider keeps one client per page load to survive that. */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/* The variable used to sit on <body>, which this shell cannot reach. Radix
   portals (menus, dialogs, popovers) mount directly under <body>, outside any
   wrapper, so the variable has to be defined on :root for them to get Inter —
   globals.css then applies it through `font-sans` on body. */
const fontVariables = `:root{--font-inter:${inter.style.fontFamily}}`;

export function SaasShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: fontVariables }} />
      {/* The theme is forced light and light is the CSS default, so
          next-themes' anti-flash <script> has nothing to prevent; its mount
          effect still sets class="light". Marked as a data block because a
          hop between groups now renders this provider on the client, where
          React 19 flags any executable <script> as an error. */}
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        forcedTheme="light"
        scriptProps={{ type: "application/json" }}
      >
        <SessionProvider>
          <AIPanelProvider>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </AIPanelProvider>
        </SessionProvider>
      </ThemeProvider>
    </>
  );
}
