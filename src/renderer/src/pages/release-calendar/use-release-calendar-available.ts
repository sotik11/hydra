import { useAppSelector } from "@renderer/hooks";
import { useSteamConnected } from "./use-steam-connected";

// The calendar is shown (profile block, sidebar entry) only when it is on in
// Settings → Integrations and the Steam integration is connected.
export function useReleaseCalendarAvailable(): boolean {
  const enabled = useAppSelector(
    (state) => state.userPreferences.value?.releaseCalendarEnabled ?? true
  );
  const steamConnected = useSteamConnected();
  return enabled && steamConnected === true;
}
