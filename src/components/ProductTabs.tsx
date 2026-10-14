import Link from "next/link";
import { cn } from "./ui";

export default function ProductTabs({ products, current, base }: { products: { key: string; label: string }[]; current: string; base: string }) {
  if (products.length < 2) return null;
  return (
    <div className="flex gap-1.5" role="tablist" aria-label="Product">
      {products.map((p) => (
        <Link key={p.key} href={`${base}?p=${p.key}`} role="tab" aria-selected={p.key === current}
          className={cn("rounded-full border px-4 py-1 text-sm font-semibold transition", p.key === current ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{p.label}</Link>
      ))}
    </div>
  );
}
