import { renderIcon } from "@/lib/server/icon";

export function GET() {
  return renderIcon(512);
}
