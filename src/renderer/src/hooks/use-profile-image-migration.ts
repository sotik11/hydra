import { useEffect, useRef } from "react";
import { useAppSelector } from "./redux";
import { useUserDetails } from "./use-user-details";
import type { UpdateProfileRequest, UserPreferences } from "@types";

/**
 * Fork: migrate the profile banner & avatar across subscription transitions,
 * on top of the subscription-guard on the display getters.
 *
 *  - While subscribed: mirror the current Hydra Cloud image into userData so the
 *    local fallback stays fresh for when the subscription lapses (we can't catch
 *    the exact expiry moment, so we keep the local copy current instead). Only
 *    re-downloads when the Cloud URL actually changed (tracked by a marker).
 *  - On becoming a subscriber (false -> true): if the Cloud slot is empty, push
 *    the local image up once so it isn't lost. Never overwrites an existing
 *    Cloud image; the next refresh then mirrors it back.
 *
 * Everything is best-effort and runs in the background; failures are swallowed
 * (the main process logs them). Own-user only — it reads the signed-in user's
 * own details and preferences, both of which survive sign-out/relogin.
 */
export function useProfileImageMigration() {
  const { userDetails, hasActiveSubscription } = useUserDetails();
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  // Previous subscription state, to detect the false -> true edge.
  const wasSubscribedRef = useRef<boolean | null>(null);
  // Guard against overlapping async runs (userDetails/prefs can churn).
  const runningRef = useRef(false);

  useEffect(() => {
    if (!userDetails || !userPreferences) return;

    const prevSubscribed = wasSubscribedRef.current;
    wasSubscribedRef.current = hasActiveSubscription;

    // Migration only ever acts while subscribed (mirror down, or seed up on the
    // edge). When not subscribed the guarded getters already show the local one.
    if (!hasActiveSubscription || runningRef.current) return;

    const becameSubscriber = prevSubscribed === false;

    const slots = [
      {
        kind: "banner" as const,
        cloudUrl: userDetails.backgroundImageUrl,
        localPath: userPreferences.localProfileBannerPath ?? null,
        mirroredUrl: userPreferences.localProfileBannerMirroredUrl ?? null,
        buildUpload: (p: string): UpdateProfileRequest => ({
          backgroundImageUrl: p,
        }),
        buildMirrorPrefs: (
          path: string,
          url: string
        ): Partial<UserPreferences> => ({
          localProfileBannerPath: path,
          localProfileBannerMirroredUrl: url,
        }),
      },
      {
        kind: "avatar" as const,
        cloudUrl: userDetails.profileImageUrl,
        localPath: userPreferences.localProfileAvatarPath ?? null,
        mirroredUrl: userPreferences.localProfileAvatarMirroredUrl ?? null,
        buildUpload: (p: string): UpdateProfileRequest => ({
          profileImageUrl: p,
        }),
        buildMirrorPrefs: (
          path: string,
          url: string
        ): Partial<UserPreferences> => ({
          localProfileAvatarPath: path,
          localProfileAvatarMirroredUrl: url,
        }),
      },
    ];

    const run = async () => {
      runningRef.current = true;
      try {
        for (const slot of slots) {
          // false -> true edge: seed an empty Cloud slot from the local image.
          if (becameSubscriber && !slot.cloudUrl && slot.localPath) {
            await window.electron
              .updateProfile(slot.buildUpload(slot.localPath))
              .catch(() => {});
            // Nothing to mirror yet; the profile refresh will surface the new
            // Cloud URL and the next run mirrors it back down.
            continue;
          }

          // Mirror Cloud -> local whenever the Cloud image changed.
          if (slot.cloudUrl && slot.cloudUrl !== slot.mirroredUrl) {
            const localPath = await window.electron.mirrorRemoteProfileImage(
              slot.kind,
              slot.cloudUrl
            );
            if (localPath) {
              await window.electron
                .updateUserPreferences(
                  slot.buildMirrorPrefs(localPath, slot.cloudUrl)
                )
                .catch(() => {});
            }
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    void run();
  }, [userDetails, userPreferences, hasActiveSubscription]);
}
