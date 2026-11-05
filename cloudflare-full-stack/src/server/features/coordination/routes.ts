import { Hono } from "hono";
import type { HonoEnv } from "../../shared/app";
export const coordinationRoutes = new Hono<HonoEnv>();
coordinationRoutes.post("/", c => c.env.COORDINATOR.get(c.env.COORDINATOR.idFromName(c.get("user").id)).fetch("https://coordinator/"));
