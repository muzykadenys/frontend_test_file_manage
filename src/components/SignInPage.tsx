import React from "react";
import Head from "next/head";
import Link from "next/link";
import { NextRouter, withRouter } from "next/router";
import type { AuthState } from "@/store/types";
import type { AppStoreApi } from "@/store/appStore";
import { useAppStore } from "@/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, LogIn, Mail } from "lucide-react";

type Props = { router: NextRouter; auth: AuthState; store: AppStoreApi };

function readRedirectFromLocation(router: NextRouter): string | undefined {
  if (typeof window !== "undefined" && window.location.search) {
    const sp = new URLSearchParams(window.location.search);
    const r = sp.get("redirect");
    if (typeof r === "string" && r.startsWith("/") && !r.startsWith("//")) return r;
  }
  const q = router.query.redirect;
  const raw = typeof q === "string" ? q : Array.isArray(q) ? q[0] : undefined;
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return undefined;
}

class SignInPageInner extends React.Component<Props> {
  private redirectAfterAuth = () => {
    const { router } = this.props;
    const redirectStr = readRedirectFromLocation(router);
    if (!redirectStr) {
      void router.replace("/");
      return;
    }
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
      const u = new URL(redirectStr, base);
      const query: Record<string, string> = {};
      u.searchParams.forEach((v, k) => {
        query[k] = v;
      });
      const pathname = u.pathname || "/";
      if (Object.keys(query).length > 0) {
        void router.replace({ pathname, query }, undefined, { shallow: true });
      } else {
        void router.replace(pathname);
      }
    } catch {
      void router.replace("/");
    }
  };

  private redirectHomeIfAuthed = () => {
    if (this.props.auth.accessToken) {
      this.redirectAfterAuth();
    }
  };

  componentDidMount() {
    this.redirectHomeIfAuthed();
  }

  componentDidUpdate(prev: Props) {
    if (this.props.auth.accessToken && this.props.auth.accessToken !== prev.auth.accessToken) {
      this.redirectAfterAuth();
    }
  }

  private onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    void this.props.store.login(email, password);
  };

  render() {
    const { auth } = this.props;
    if (auth.accessToken) {
      return (
        <>
          <Head>
            <title>Sign in</title>
          </Head>
          <div className="flex min-h-screen items-center justify-center p-6">
            <p className="text-sm text-muted-foreground">Redirecting…</p>
          </div>
        </>
      );
    }
    return (
      <>
        <Head>
          <title>Sign in</title>
        </Head>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-6 w-6 text-muted-foreground" aria-hidden />
                Sign in
              </CardTitle>
              <CardDescription>Enter your email and password to continue.</CardDescription>
            </CardHeader>
            <form onSubmit={this.onSubmit}>
              <CardContent className="space-y-4">
                {auth.error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{auth.error}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
                    Email
                  </Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="inline-flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                    Password
                  </Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button className="w-full" type="submit" disabled={auth.loading}>
                  <LogIn className="h-4 w-4" />
                  {auth.loading ? "…" : "Sign in"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  No account?{" "}
                  <Button variant="link" className="h-auto p-0" asChild>
                    <Link href="/sign-up">Sign up</Link>
                  </Button>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </>
    );
  }
}

function SignInWithStore(props: { router: NextRouter }) {
  const { auth, store } = useAppStore();
  return <SignInPageInner {...props} auth={auth} store={store} />;
}

export default withRouter(SignInWithStore);
