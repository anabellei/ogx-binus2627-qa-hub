"use client";
import { signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Card() {
  const sp = useSearchParams();
  const err = sp.get("error");
  return (
    <div className="mx-auto mt-24 max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white"><ShieldCheck size={26} /></span>
      <h1 className="mt-4 text-xl font-bold text-slate-900">oGX QA Hub</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in with the Google account that has access to the tracker and the Drive folder.</p>
      {err && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err === "AccessDenied" ? "That account isn't allowed. Use your organization account." : "Sign-in failed. Please try again."}</p>}
      <button onClick={() => signIn("google", { callbackUrl: sp.get("callbackUrl") ?? "/" })}
        className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Continue with Google</button>
    </div>
  );
}
export default function Login() { return <Suspense><Card /></Suspense>; }
