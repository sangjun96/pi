import { useEffect, useState } from "react";
import { authClient } from "../features/auth/client";
import { SignInForm } from "../features/auth/SignInForm";
import { GenerationExamples } from "../features/ai-text/GenerationExamples";
import { Button } from "../shared/components/ui/button";

export function App() {
  const { data: session, isPending } = authClient.useSession();
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("theme", dark ? "dark" : "light"); }, [dark]);
  if (isPending) return <main className="p-8">Loading…</main>;
  return <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Cloudflare Full Stack</h1>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? "light" : "dark"} theme`}>{dark ? "Light" : "Dark"}</Button>
        {session && <Button variant="outline" onClick={() => authClient.signOut()}>Sign out</Button>}
      </div>
    </header>
    {session ? <><p>Signed in as {session.user.email}</p><GenerationExamples /></> : <SignInForm />}
  </main>;
}
