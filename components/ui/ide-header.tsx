"use client"

import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import Logo from "@/components/ui/logo"
import ThemeToggle from "@/components/ui/theme-toggle"

interface IDEHeaderProps {
  isDarkMode: boolean
  onThemeToggle: () => void
}

export default function IDEHeader({ isDarkMode, onThemeToggle }: IDEHeaderProps) {
  return (
    <header className="h-12 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Logo />

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700">
            File
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700">
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700">
            View
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700">
            Tools
          </Button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle isDarkMode={isDarkMode} onToggle={onThemeToggle} />
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
