import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider, useT } from "@/lib/i18n";
import { TopBar } from "@/components/layout/TopBar";
import { MockBanner } from "@/components/layout/MockBanner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/auth/AuthScreen";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong max-w-md rounded-2xl p-8 text-center">
        <h1 className="font-display text-7xl font-bold text-gradient-cyan">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Pagina non trovata</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-emerald px-4 py-2 text-sm font-medium text-background transition-colors hover:brightness-110"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong max-w-md rounded-2xl p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Errore di caricamento</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Qualcosa è andato storto. Puoi provare a ricaricare o tornare alla home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-xl bg-emerald px-4 py-2 text-sm font-medium text-background transition-colors hover:brightness-110"
          >
            Riprova
          </button>
          <a
            href="/"
            className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Enterprise Big Data Intelligence Platform" },
      { name: "description", content: "Ricerca ed esportazione su 34.2 milioni di record italiani. Sviluppato da DataNexus Analytics" },
      { name: "author", content: "DataNexus Analytics" },
      { property: "og:title", content: "Enterprise Big Data Intelligence Platform" },
      { property: "og:description", content: "Motore di ricerca ed esportazione su 34.2M di record italiani. DataNexus Analytics" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/logo.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logo.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <RootContent />
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootContent() {
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col justify-between px-4 pb-8">
      <div>
        <TopBar />
        <MockBanner />
        {loading ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald border-t-transparent shadow-[0_0_20px_var(--accent-emerald)]" />
            <p className="font-display text-sm font-medium tracking-wide text-muted-foreground animate-pulse">
              Verificando identità di sicurezza...
            </p>
          </div>
        ) : !user ? (
          <AuthScreen />
        ) : (
          <Outlet />
        )}
      </div>
      <Footer />
    </div>
  );
}

function Footer() {
  const { lang } = useT();
  return (
    <footer className="mx-auto mt-20 w-full max-w-7xl border-t border-white/5 pt-8 text-center text-xs text-muted-foreground/60 sm:flex sm:items-center sm:justify-between sm:px-4 sm:text-left">
      <div className="flex items-center justify-center gap-2 font-display font-medium text-foreground/80 sm:justify-start">
        <img
          src="/logo.png"
          alt="DataNexus Logo"
          className="h-5 w-5 object-contain rounded-sm"
        />
        <span className="tracking-wide">DataNexus Analytics</span>
      </div>
      <div className="mt-3 sm:mt-0">
        {lang === "it"
          ? "Sviluppato con precisione ed eccellenza da "
          : "Desenvolvido com excelência e precisão por "}
        <span className="font-semibold text-emerald">DataNexus Analytics</span>
      </div>
    </footer>
  );
}
