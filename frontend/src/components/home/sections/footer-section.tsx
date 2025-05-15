"use client";


import { useMediaQuery } from "@/hooks/use-media-query";
import { siteConfig } from "@/lib/home";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function FooterSection() {
  const tablet = useMediaQuery("(max-width: 1024px)");
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // After mount, we can access the theme
  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = !mounted ? "/agent0-logo.png" : 
    (resolvedTheme === "dark" ? "/agent0-logo-white.png" : "/agent0-logo.png");

  return (
    <footer id="footer" className="w-full py-6 border-t border-purple-900/30 bg-black/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
        <div className="text-purple-400 font-medium text-lg mb-4 md:mb-0">
          Thanus
        </div>
        
        <div className="flex space-x-6 text-sm text-purple-300">
          <Link href="/sobre" className="hover:text-purple-400 transition-colors">
            Sobre
          </Link>
          <Link href="/termos" className="hover:text-purple-400 transition-colors">
            Termos
          </Link>
          <Link href="/privacidade" className="hover:text-purple-400 transition-colors">
            Privacidade
          </Link>
          <Link href="/contato" className="hover:text-purple-400 transition-colors">
            Contato
          </Link>
        </div>
      </div>
    </footer>
  );
}
