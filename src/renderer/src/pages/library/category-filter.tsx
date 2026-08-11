import { StackIcon, DeviceDesktopIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import "./steam-filter-i18n";
import "./category-filter.scss";

export type LibraryCategory = "all" | "pc" | "classics" | "steam";

// Monochrome Steam glyph (currentColor) to match the other platform icons in
// the filter menu (they use monochrome octicons).
export function SteamIcon({
  size = 14,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658a3.4 3.4 0 0 1 1.912-.59q.094 0 .188.006l2.861-4.142v-.059a4.53 4.53 0 0 1 4.524-4.524 4.53 4.53 0 0 1 4.524 4.527 4.53 4.53 0 0 1-4.524 4.525h-.105l-4.076 2.911q.004.078.004.159a3.396 3.396 0 0 1-6.721.669L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0M7.54 18.21l-1.473-.61a2.56 2.56 0 0 0 1.314 1.25 2.55 2.55 0 0 0 3.332-1.375 2.54 2.54 0 0 0 .005-1.949 2.54 2.54 0 0 0-1.377-1.383 2.54 2.54 0 0 0-1.878-.03l1.523.63a1.877 1.877 0 0 1-1.445 3.467zm11.415-9.303a3.02 3.02 0 0 0-3.015-3.015 3.02 3.02 0 0 0-3.015 3.015 3.02 3.02 0 0 0 3.015 3.015 3.02 3.02 0 0 0 3.015-3.015m-5.273-.005a2.26 2.26 0 0 1 2.265-2.266 2.267 2.267 0 0 1 0 4.531 2.26 2.26 0 0 1-2.265-2.265" />
    </svg>
  );
}

export function ClassicsIcon({
  size = 14,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#classics-switch-gradient)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient
          id="classics-switch-gradient"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f8c802" />
          <stop offset="25%" stopColor="#fc5812" />
          <stop offset="50%" stopColor="#fb0026" />
          <stop offset="75%" stopColor="#c80078" />
          <stop offset="100%" stopColor="#7300a4" />
        </linearGradient>
      </defs>
      <line x1="6" x2="10" y1="11" y2="11" />
      <line x1="8" x2="8" y1="9" y2="13" />
      <line x1="15" x2="15.01" y1="12" y2="12" />
      <line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

interface CategoryFilterProps {
  category: LibraryCategory;
  onCategoryChange: (category: LibraryCategory) => void;
}

export function CategoryFilter({
  category,
  onCategoryChange,
}: Readonly<CategoryFilterProps>) {
  const { t } = useTranslation("library");

  const options: {
    value: LibraryCategory;
    label: string;
    icon: JSX.Element;
  }[] = [
    { value: "all", label: t("category_all"), icon: <StackIcon size={14} /> },
    {
      value: "pc",
      label: t("category_pc"),
      icon: <DeviceDesktopIcon size={14} />,
    },
    {
      value: "classics",
      label: t("category_classics"),
      icon: <ClassicsIcon size={16} />,
    },
    {
      value: "steam",
      label: t("category_steam"),
      icon: <SteamIcon size={14} />,
    },
  ];

  return (
    <div className="library-category-filter__container">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`library-category-filter__option ${category === option.value ? "library-category-filter__option--active" : ""}`}
          onClick={() => onCategoryChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
