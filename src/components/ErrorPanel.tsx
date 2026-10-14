import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ErrorPanel({ message, title = "Couldn't load this page" }: { message: string; title?: string }) {
  const auth = /sign in|session expired/i.test(message);
  const settings = /settings/i.test(message);
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
      <AlertTriangle className="mx-auto text-red-500" />
      <h1 className="mt-2 text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      <Link href={auth ? "/login" : settings ? "/settings" : "/"} className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        {auth ? "Sign in again" : settings ? "Open Settings" : "Try again"}
      </Link>
    </div>
  );
}
