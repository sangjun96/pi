import { DurableObject } from "cloudflare:workers";
import type { AppEnv } from "../../shared/env";

export class Coordinator extends DurableObject<AppEnv> {
  async fetch(): Promise<Response> {
    const count = (await this.ctx.storage.get<number>("count") ?? 0) + 1;
    await this.ctx.storage.put("count", count);
    return Response.json({ count });
  }
}
