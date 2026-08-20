import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "@primer/octicons-react";

import { useAppSelector } from "@renderer/hooks";

import "./profile-tagline-i18n";

const MAX_LENGTH = 120;

interface ProfileTaglineProps {
  isMe: boolean;
}

// Fork: a local free-text line under the profile name. Stored locally in
// UserPreferences (not Hydra Cloud) and only shown/editable on your own profile.
export function ProfileTagline({ isMe }: Readonly<ProfileTaglineProps>) {
  const { t } = useTranslation("profile_fork");
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const tagline = userPreferences?.localProfileTagline ?? "";

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  // Local-only: nothing to show on someone else's profile.
  if (!isMe) return null;

  const save = async (value: string) => {
    const trimmed = value.trim().slice(0, MAX_LENGTH);
    setIsEditing(false);
    // Call the IPC directly — the profile is rendered outside SettingsContext,
    // where updateUserPreferences is a no-op.
    await window.electron.updateUserPreferences({
      localProfileTagline: trimmed || null,
    });
  };

  if (isEditing) {
    return (
      <div className="profile-hero__tagline-edit">
        <input
          ref={inputRef}
          type="text"
          className="profile-hero__tagline-input"
          maxLength={MAX_LENGTH}
          value={draft}
          placeholder={t("tagline_placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save(draft);
            if (event.key === "Escape") setIsEditing(false);
          }}
          onBlur={() => void save(draft)}
        />
        <button
          type="button"
          className="profile-hero__tagline-clear"
          aria-label={t("tagline_clear")}
          title={t("tagline_clear")}
          // Keep the input focused (avoid its blur firing first) and clear.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setDraft("");
            void save("");
          }}
        >
          <XIcon size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`profile-hero__tagline ${
        tagline ? "" : "profile-hero__tagline--empty"
      }`}
      onClick={() => {
        setDraft(tagline);
        setIsEditing(true);
      }}
    >
      {tagline || t("tagline_placeholder")}
    </button>
  );
}
