import { renderIcon } from "@/lib/server/icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS applies its own corner mask, so render full-bleed.
  return renderIcon(180, { maskable: true });
}
