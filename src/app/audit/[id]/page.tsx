import AuditOverview from "@/components/AuditOverview";
import ErrorPanel from "@/components/ErrorPanel";
import ProductTabs from "@/components/ProductTabs";
import { getCtx } from "@/lib/auth";
import { getConfig } from "@/lib/appconfig";
import { overview } from "@/lib/audit-service";

export const dynamic = "force-dynamic";

export default async function AuditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  try {
    const { token } = await getCtx();
    const cfg = await getConfig(token);
    const data = await overview(token, id, sp.p);
    const current = cfg.products.find((p) => p.label === data.product)?.key ?? cfg.products[0]?.key ?? "";
    return (
      <>
        <div className="mx-auto max-w-5xl px-4 pt-5"><ProductTabs products={cfg.products.map((p) => ({ key: p.key, label: p.label }))} current={current} base={`/audit/${id}`} /></div>
        <AuditOverview data={data} product={current} />
      </>
    );
  } catch (e) { return <ErrorPanel message={(e as Error).message} title="Couldn't load the audit" />; }
}
