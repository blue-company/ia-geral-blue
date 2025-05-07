"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function InventuAILogo() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // After mount, we can access the theme
  useEffect(() => {
    setMounted(true)
  }, [])
  
  return (
    <div className="flex h-6 w-6 items-center justify-center flex-shrink-0">
      <Image
        src="/agent-circles-logo-new.png"
        alt="Agent ZERO"
        width={24}
        height={24}
        priority
        unoptimized
      />
    </div>
  )
}
