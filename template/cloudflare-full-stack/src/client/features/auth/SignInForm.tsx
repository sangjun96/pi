import { useState, type FormEvent } from "react";
import { authClient } from "./client";
import { Button } from "../../shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Input } from "../../shared/components/ui/input";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || "Sign in failed");
      setPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed"); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>Sign in</CardTitle><CardDescription>Accounts are created by an operator.</CardDescription></CardHeader>
    <CardContent><form onSubmit={login} className="flex flex-col gap-4">
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <label className="flex flex-col gap-2">Email<Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label className="flex flex-col gap-2">Password<Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      <Button disabled={busy}>Sign in</Button>
    </form></CardContent>
  </Card>;
}
