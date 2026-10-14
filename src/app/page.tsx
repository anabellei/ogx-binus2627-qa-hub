import Dashboard from "@/components/Dashboard";
import ErrorPanel from "@/components/ErrorPanel";
import ProductTabs from "@/components/ProductTabs";
import { getCtx } from "@/lib/auth";
import { productCtx, snapshot } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  try {
    const { token } = await getCtx();
    const pc = await productCtx(token, sp.p);
    const s = await snapshot(token, pc);
    return (
      <>
        <div className="mx-auto max-w-6xl px-4 pt-5"><ProductTabs products={s.products} current={pc.cfg.key} base="/" /></div>
        <Dashboard eps={s.eps} warnings={s.warnings} sheetUrl={s.sheetUrl} product={pc.cfg.key} />
      </>
    );
  } catch (e) { return <ErrorPanel message={(e as Error).message} title="Couldn't load the tracker" />; }
}
