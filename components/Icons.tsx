interface IconProps {
  name:
    | "cart"
    | "todo"
    | "note"
    | "people"
    | "plus"
    | "check"
    | "dots"
    | "x"
    | "share"
    | "copy"
    | "trash"
    | "chevron-down"
    | "chevron-left";
  size?: number;
}

const PATHS: Record<IconProps["name"], React.ReactNode> = {
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2.2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.3L20.5 8H6.1" />
    </>
  ),
  todo: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8.5 12.2l2.4 2.4 4.8-5" />
    </>
  ),
  note: (
    <>
      <path d="M5 4.5h14a1 1 0 0 1 1 1v9l-5.5 5.5H5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1z" />
      <path d="M14.5 20v-4.5a1 1 0 0 1 1-1H20" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15.5 5.7a3.2 3.2 0 0 1 0 5.6" />
      <path d="M17.5 14.8c1.9.7 3 2.3 3 4.7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6L9 17l-5-5" />,
  dots: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  share: (
    <>
      <path d="M12 3v12" />
      <path d="M8 6.5L12 3l4 3.5" />
      <path d="M5 11v8a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-8" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.7" />
      <path d="M6.5 6.5l.8 12.6a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.6" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  "chevron-left": <path d="M14.5 5.5L8 12l6.5 6.5" />,
};

export function Icon({ name, size = 22 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
