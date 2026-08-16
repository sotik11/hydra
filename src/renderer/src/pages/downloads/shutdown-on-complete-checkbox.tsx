import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameShop } from "@types";

import "./shutdown-i18n";

interface ShutdownOnCompleteCheckboxProps {
  shop: GameShop;
  objectId: string;
}

// Per-download "shut down when finished" toggle shown on the active download.
// Self-contained: loads its state from main and writes it back on the fly, so it
// always reflects the flag for the download currently on screen.
export function ShutdownOnCompleteCheckbox({
  shop,
  objectId,
}: Readonly<ShutdownOnCompleteCheckboxProps>) {
  const { t } = useTranslation("shutdown");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    window.electron
      .getShutdownOnComplete(shop, objectId)
      .then((value) => {
        if (active) setChecked(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shop, objectId]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    setChecked(value);
    void window.electron.setShutdownOnComplete(shop, objectId, value);
  };

  return (
    <label className="download-group__shutdown-toggle">
      <input type="checkbox" checked={checked} onChange={handleChange} />
      <span>{t("shutdown_on_complete")}</span>
    </label>
  );
}
