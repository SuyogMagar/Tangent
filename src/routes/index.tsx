import { createFileRoute } from "@tanstack/react-router";
import { Scene3D } from "@/components/Scene3D";
import { Nav } from "@/components/Nav";
import {
  Hero,
  CarbonSection,
  ChemicalsSection,
  ProcessSection,
  CTASection,
} from "@/components/Sections";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Tangent — Carbon Fiber & Advanced Chemicals" },
      {
        name: "description",
        content:
          "Tangent engineers aerospace-grade carbon fiber and high-purity specialty chemicals for the industries shaping tomorrow.",
      },
      { property: "og:title", content: "Tangent — Carbon Fiber & Advanced Chemicals" },
      {
        property: "og:description",
        content: "Aerospace-grade carbon fiber and high-purity specialty chemicals.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@300;400;500;600&family=Orbitron:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
});

function Index() {
  return (
    <div className="relative bg-hero min-h-screen overflow-x-hidden">
      <Scene3D />
      <div className="relative z-10">
        <Nav />
        <Hero />
        <CarbonSection />
        <ChemicalsSection />
        <ProcessSection />
        <CTASection />
      </div>
    </div>
  );
}
