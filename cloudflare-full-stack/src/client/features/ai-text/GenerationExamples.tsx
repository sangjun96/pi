import { useState } from "react";
import { Button } from "../../shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Textarea } from "../../shared/components/ui/textarea";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const result = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}

/** Optional example UI. Remove this component without changing authentication. */
export function GenerationExamples() {
  const [text, setText] = useState("");
  const [output, setOutput] = useState("");
  const [job, setJob] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setError(""); setBusy(true);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); } finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>AI examples</CardTitle><CardDescription>Optional examples for text generation and speech.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-4">
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <label className="flex flex-col gap-2">Prompt or speech text<Textarea rows={5} maxLength={4000} value={text} onChange={e => setText(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !text.trim()} onClick={() => run(async () => { const r = await api<{ text: string }>("/api/ai/text", { method: "POST", body: JSON.stringify({ text }) }); setOutput(r.text); })}>Generate text</Button>
        <Button variant="secondary" disabled={busy || !text.trim()} onClick={() => run(async () => { const r = await api<{ id: string; status: string }>("/api/audio/jobs", { method: "POST", body: JSON.stringify({ text }) }); setJob(r.id); setStatus(r.status); })}>Create speech</Button>
        {job && <Button variant="outline" disabled={busy} onClick={() => run(async () => { const r = await api<{ status: string }>(`/api/audio/jobs/${job}`); setStatus(r.status); })}>Refresh audio status</Button>}
      </div>
      {output && <pre className="whitespace-pre-wrap rounded border border-border p-4">{output}</pre>}
      {job && <p aria-live="polite">Audio: {status}</p>}
      {job && status === "complete" && <audio controls src={`/api/audio/jobs/${job}/audio`} />}
    </CardContent>
  </Card>;
}
