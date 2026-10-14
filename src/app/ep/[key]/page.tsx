import { notFound } from "next/navigation";
import EpChecklist from "@/components/EpChecklist";
import ErrorPanel from "@/components/ErrorPanel";
import { getCtx } from "@/lib/auth";
import { productCtx, snapshot } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function EpPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ p?: string }> }) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  let s, pc;
  try { const { token } = await getCtx(); pc = await productCtx(token, sp.p); s = await snapshot(token, pc); }
  catch (e) { return <ErrorPanel message={(e as Error).message} />; }
  const ep = s.eps.find((e) => e.key === key);
  if (!ep) notFound();
  return <EpChecklist initial={ep} items={s.items} sheetUrl={s.sheetUrl} product={pc.cfg.key} />;
}
