"use client"

import { Button } from "@/components/ui/button"
import { Play, Square, Upload, Download } from "lucide-react"

interface IDEToolbarProps {
  onCompile: () => void
  onStop?: () => void
  onUpload?: () => void
  onDownload?: () => void
}

export default function IDEToolbar({ onCompile, onStop, onUpload, onDownload }: IDEToolbarProps) {
  return (
    <div className="h-10 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onCompile} className="bg-orange-600 hover:bg-orange-700 text-white font-medium">
          <Play className="w-4 h-4 mr-1" />
          Compile
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white bg-transparent"
        >
          <Square className="w-4 h-4 mr-1" />
          Stop
        </Button>
        <div className="w-px h-6 bg-slate-600 mx-2" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onUpload}
          className="text-slate-300 hover:text-white hover:bg-slate-700"
        >
          <Upload className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDownload}
          className="text-slate-300 hover:text-white hover:bg-slate-700"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
