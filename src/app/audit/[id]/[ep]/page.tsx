import { notFound } from "next/navigation";
import AuditEp from "@/components/AuditEp";
import ErrorPanel from "@/components/ErrorPanel";
import { getCtx } from "@/lib/auth";
import { getConfig } from "@/lib/appconfig";
import { epDetail } from "@/lib/audit-service";
import { HttpError } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AuditEpPage({ params, searchParams }: { params: Promise<{ id: string; ep: string }>; searchParams: Promise<{ p?: string }> }) {
  const [{ id, ep }, sp] = await Promise.all([params, searchParams]);
  try {
    const { token } = await getCtx();
    const cfg = await getConfig(token);
    const detail = await epDetail(token, id, sp.p, ep);
    const product = cfg.products.find((p) => p.label === detail.product)?.key ?? sp.p ?? "";
    return <AuditEp initial={detail} product={product} />;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404 && /isn't in the audit sheet/.test(e.message)) notFound();
    return <ErrorPanel message={(e as Error).message} title="Couldn't load this EP's audit" />;
  }
}
