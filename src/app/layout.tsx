import "./globals.css";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { getUserOnly } from "@/lib/auth";
import { DEMO } from "@/lib/config";

export const metadata: Metadata = { title: "oGX QA Hub", description: "Exchange Standard QA: upload, auto-name, auto-track." };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserOnly().catch(() => null);
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Header user={user} demo={DEMO} />
        <main>{children}</main>
      </body>
    </html>
  );
}
