"use client";

import { HeroSection } from "@/components/home/sections/hero-section";
import { FooterSection } from "@/components/home/sections/footer-section";
import { ScatteredParticles } from "@/components/ui/scattered-particles";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full bg-black">
      <ScatteredParticles />
      <div className="w-full">
        <HeroSection />
        <FooterSection />
      </div>
    </main>
  );
}
