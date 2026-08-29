import { Suspense } from "react";
import { HomeScreen } from "@/components/HomeScreen";

export default function HomePage() {
  return (
    <Suspense>
      <HomeScreen />
    </Suspense>
  );
}
