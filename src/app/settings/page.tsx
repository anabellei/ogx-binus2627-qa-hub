import SettingsForm from "@/components/SettingsForm";
import ErrorPanel from "@/components/ErrorPanel";
import { getCtx } from "@/lib/auth";
import { getConfig } from "@/lib/appconfig";
import { DEMO } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    const { token } = await getCtx();
    return <SettingsForm initial={await getConfig(token, true)} demo={DEMO} />;
  } catch (e) { return <ErrorPanel message={(e as Error).message} title="Couldn't load settings" />; }
}
