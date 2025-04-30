"use client";

import { HeroSection } from "@/components/home/sections/hero-section";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full">
      <div className="w-full divide-y divide-border">
        <HeroSection />
      </div>
    </main>
  );
} 