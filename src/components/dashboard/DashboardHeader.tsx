import Link from "next/link";
import { LogIn, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  email?: string | null;
  onLogout: () => void;
  /** When not signed in, show this link (e.g. /sign-in?redirect=…). */
  signInHref?: string;
};

export function DashboardHeader({ email, onLogout, signInHref }: Props) {
  const signedIn = !!email?.trim();
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="mt-0.5 flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-lg">
          <Mail
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate" title={email ?? undefined}>
            {signedIn ? email : "Not signed in"}
          </span>
        </h1>
      </div>
      {signedIn ? (
        <Button type="button" variant="ghost" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      ) : signInHref ? (
        <Button type="button" variant="default" asChild>
          <Link href={signInHref}>
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        </Button>
      ) : null}
    </header>
  );
}
