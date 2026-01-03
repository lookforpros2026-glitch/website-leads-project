import { getSiteSettings } from "@/lib/settings";
import SettingsClient from "@/components/admin/settings/SettingsClient";

export default async function SettingsPage() {
  const settings = await getSiteSettings();

  return (
    <SettingsClient initial={settings} />
  );
}
