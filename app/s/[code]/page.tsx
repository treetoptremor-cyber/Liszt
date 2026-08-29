import { SpaceApp } from "@/components/SpaceApp";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <SpaceApp code={decodeURIComponent(code)} />;
}
