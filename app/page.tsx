"use client";

import type React from "react";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import FileExplorer from "@/components/file-explorer";
import CodeEditor from "@/components/code-editor";
import CompilerInterface from "@/components/compiler-interface";
import MCPInterface from "@/components/mcp-interface";
import ConsolePanel from "@/components/console-panel";
import IDEHeader from "@/components/ui/ide-header";
import IDEToolbar from "@/components/ui/ide-toolbar";
import StatusBar from "@/components/ui/status-bar";
import FileTabs from "@/components/ui/file-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type FileTreeNode } from "@/lib/file-system";

export default function Solmix() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState(200); // Default 200px height
  const [compilerWidth, setCompilerWidth] = useState(320); // 320px = w-80
  const [isResizing, setIsResizing] = useState(false);
  const [isVerticalResizing, setIsVerticalResizing] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState("compiler");
  const resizeRef = useRef<HTMLDivElement>(null);
  const verticalResizeRef = useRef<HTMLDivElement>(null);

  const [activeFile, setActiveFile] = useState<FileTreeNode | null>({
    id: "mycontract",
    name: "MyContract.sol",
    type: "file",
    extension: "sol",
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    children: [],
  });
  const [openTabs, setOpenTabs] = useState<FileTreeNode[]>([
    {
      id: "mycontract",
      name: "MyContract.sol",
      type: "file",
      extension: "sol",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      children: [],
    },
  ]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = compilerWidth;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = startX - e.clientX; // Reverse direction since we're resizing from left edge
        const newWidth = Math.min(Math.max(startWidth + deltaX, 250), 600); // Min 250px, Max 600px
        setCompilerWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [compilerWidth]
  );

  const handleVerticalMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsVerticalResizing(true);

      const startY = e.clientY;
      const startHeight = consoleHeight;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = startY - e.clientY; // Reverse direction since we're resizing from top edge
        const newHeight = Math.min(Math.max(startHeight + deltaY, 100), 500); // Min 100px, Max 500px
        setConsoleHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsVerticalResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [consoleHeight]
  );

  const handleFileSelect = (file: FileTreeNode) => {
    setActiveFile(file);
    // Add to open tabs if not already open
    if (!openTabs.find((tab) => tab.id === file.id)) {
      setOpenTabs((prev) => [...prev, file]);
    }
  };

  const closeTab = (fileId: string) => {
    const newTabs = openTabs.filter((tab) => tab.id !== fileId);
    setOpenTabs(newTabs);

    // If closing active tab, switch to another tab or null
    if (activeFile?.id === fileId) {
      setActiveFile(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
    }
  };

  const switchTab = (file: FileTreeNode) => {
    setActiveFile(file);
  };

  const handleCompile = () => {
    console.log("Compiling contract:", activeFile?.name);
    // Compilation logic would go here
  };

  return (
    <div
      className={cn(
        "h-screen flex flex-col bg-slate-900 text-slate-100",
        isDarkMode ? "dark" : ""
      )}
    >
      <IDEHeader
        isDarkMode={isDarkMode}
        onThemeToggle={() => setIsDarkMode(!isDarkMode)}
      />

      <div className="flex items-center justify-between">
        <IDEToolbar onCompile={handleCompile} />
        <div className="px-4">
          <StatusBar />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Explorer */}
        <aside className="w-64 bg-slate-850 border-r border-slate-700 flex flex-col">
          <FileExplorer onFileSelect={handleFileSelect} />
        </aside>

        {/* Editor Area */}
        <main className="flex-1 flex flex-col">
          <FileTabs
            tabs={openTabs}
            activeTab={activeFile}
            onTabClick={switchTab}
            onTabClose={closeTab}
          />

          {/* Code Editor */}
          <div className="flex-1">
            <CodeEditor activeFile={activeFile} />
          </div>
        </main>

        {/* Right Sidebar - Compiler & MCP */}
        <aside
          className="bg-slate-850 border-l border-slate-700 flex flex-col relative h-full"
          style={{ width: `${compilerWidth}px` }}
        >
          <div
            ref={resizeRef}
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-500/50 transition-colors",
              "group flex items-center justify-center",
              isResizing && "bg-orange-500"
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-orange-500 transition-colors" />
          </div>

          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Tabs
              value={activeRightTab}
              onValueChange={setActiveRightTab}
              className="flex flex-col h-full"
            >
              <TabsList className="grid w-full grid-cols-2 bg-slate-800 border-b border-slate-700 rounded-none h-10">
                <TabsTrigger
                  value="compiler"
                  className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-orange-400"
                >
                  Compiler
                </TabsTrigger>
                <TabsTrigger
                  value="mcp"
                  className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-orange-400"
                >
                  MCP + Eliza
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="compiler"
                className="flex-1 m-0 overflow-hidden"
              >
                <CompilerInterface
                  activeFile={activeFile}
                  onCompile={handleCompile}
                />
              </TabsContent>

              <TabsContent value="mcp" className="flex-1 m-0 overflow-hidden">
                <MCPInterface />
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      </div>

      {/* Console Panel */}
      <div className="relative" style={{ height: `${consoleHeight}px` }}>
        <div
          ref={verticalResizeRef}
          className={cn(
            "absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-orange-500/50 transition-colors z-10",
            "group flex items-center justify-center",
            isVerticalResizing && "bg-orange-500"
          )}
          onMouseDown={handleVerticalMouseDown}
        >
          <div className="w-8 h-0.5 bg-slate-600 group-hover:bg-orange-500 transition-colors" />
        </div>

        <ConsolePanel height={consoleHeight} />
      </div>
    </div>
  );
}
