import type { NextRequest } from "next/server";
import { getCtx } from "./auth";
import { productCtx } from "./service";

/** Signed-in user + the product (GV, GTa, ...) this request is about. */
export async function apiCtx(req: NextRequest, product?: string | null) {
  const c = await getCtx(req);
  const pc = await productCtx(c.token, product ?? req.nextUrl.searchParams.get("p"));
  return { ...c, pc };
}
