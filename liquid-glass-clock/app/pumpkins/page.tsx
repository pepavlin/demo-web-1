import type { Metadata } from "next";
import PumpkinWorld from "@/components/PumpkinWorld";

export const metadata: Metadata = {
  title: "Svět dýní",
  description: "Simulace světa dýní — rostou, rozmnožují se a hnijí.",
};

export default function PumpkinsPage() {
  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#1a0a00",
      }}
    >
      <PumpkinWorld />
    </main>
  );
}
