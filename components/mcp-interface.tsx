"use client";

import { useState } from "react";
import { Send, Settings, Zap, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MCPMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface MCPServer {
  command: string;
  args: string[];
  env?: { [key: string]: string };
}

interface MCPConfig {
  mcpServers: { [key: string]: MCPServer };
}

interface MCPInterfaceProps {
  className?: string;
}

export default function MCPInterface({ className }: MCPInterfaceProps) {
  const [messages, setMessages] = useState<MCPMessage[]>([
    {
      id: "1",
      type: "system",
      content:
        "MCP (Model Context Protocol) interface initialized. Configure your MCP servers below and connect to start interacting with Eliza AI agent.",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [elizaAgent, setElizaAgent] = useState<any>(null);
  const [mcpConfig, setMcpConfig] = useState<string>(
    JSON.stringify(
      {
        mcpServers: {
          "sei-mcp-server": {
            command: "npx",
            args: ["-y", "@sei-js/mcp-server"],
            env: {
              PRIVATE_KEY: "your_private_key_here",
            },
          },
        },
      },
      null,
      2
    )
  );

  const [configError, setConfigError] = useState<string>("");

  const validateMCPConfig = (configStr: string): boolean => {
    try {
      const config = JSON.parse(configStr) as MCPConfig;
      if (!config.mcpServers || typeof config.mcpServers !== "object") {
        setConfigError("Invalid configuration: mcpServers object is required");
        return false;
      }

      for (const [serverName, serverConfig] of Object.entries(
        config.mcpServers
      )) {
        if (!serverConfig.command || !Array.isArray(serverConfig.args)) {
          setConfigError(
            `Invalid configuration for server "${serverName}": command and args are required`
          );
          return false;
        }
      }

      setConfigError("");
      return true;
    } catch (error) {
      setConfigError("Invalid JSON format");
      return false;
    }
  };

  const handleConnect = async () => {
    if (!validateMCPConfig(mcpConfig)) {
      return;
    }

    setIsLoading(true);
    try {
      // Parse and validate the MCP configuration
      const config = JSON.parse(mcpConfig) as MCPConfig;
      const serverNames = Object.keys(config.mcpServers);

      // Connect to Eliza agent via API
      const response = await fetch('/api/eliza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to connect to Eliza agent');
      }
      
      setElizaAgent(true);
      
      setIsConnected(true);

      const connectMessage: MCPMessage = {
        id: Date.now().toString(),
        type: "system",
        content: `Successfully connected to Eliza agent with Google GenAI and MCP servers: ${serverNames.join(
          ", "
        )}. Enhanced capabilities are now available.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, connectMessage]);
    } catch (error) {
      const errorMessage: MCPMessage = {
        id: Date.now().toString(),
        type: "system",
        content:
          "Failed to connect to MCP servers. Please check your configuration.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/eliza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
    
    setIsConnected(false);
    setElizaAgent(null);
    const disconnectMessage: MCPMessage = {
      id: Date.now().toString(),
      type: "system",
      content: "Disconnected from Eliza agent and MCP servers.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, disconnectMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isConnected || !elizaAgent) return;

    const userMessage: MCPMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      // Send message to Eliza agent via API
      const response = await fetch('/api/eliza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', message: messageToSend })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const assistantMessage: MCPMessage = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: result.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(result.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error sending message to Eliza:', error);
      const errorMessage: MCPMessage = {
        id: (Date.now() + 1).toString(),
        type: "system",
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response from agent'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="h-8 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">
            MCP + Eliza
          </span>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className={cn(
              "text-xs px-2 py-0.5",
              isConnected
                ? "bg-green-600 text-white"
                : "bg-slate-600 text-slate-300"
            )}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
        >
          <Settings className="w-3 h-3" />
        </Button>
      </div>

      {/* Configuration Section */}
      {!isConnected && (
        <div className="p-3 border-b border-slate-700 space-y-3">
          <div>
            <Label className="text-xs text-slate-400 mb-1 block">
              MCP Configuration (JSON)
            </Label>
            <Textarea
              value={mcpConfig}
              onChange={(e) => {
                setMcpConfig(e.target.value);
                setConfigError("");
              }}
              placeholder="Enter your MCP server configuration..."
              className="min-h-[120px] bg-slate-700 border-slate-600 text-slate-100 text-xs font-mono"
            />
            {configError && (
              <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {configError}
              </div>
            )}
          </div>

          <Button
            onClick={handleConnect}
            disabled={isLoading || !!configError}
            className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3" />
                Connect to MCP
              </div>
            )}
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "p-2 rounded text-xs",
              message.type === "user" &&
                "bg-blue-600/20 border border-blue-600/30 ml-4",
              message.type === "assistant" &&
                "bg-green-600/20 border border-green-600/30 mr-4",
              message.type === "system" &&
                "bg-slate-700/50 border border-slate-600/50 text-slate-300"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {message.type === "user" && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
              {message.type === "assistant" && (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              )}
              {message.type === "system" && (
                <div className="w-2 h-2 bg-slate-500 rounded-full" />
              )}
              <span className="text-xs text-slate-400 capitalize">
                {message.type === "assistant" ? "Eliza" : message.type}
              </span>
              <span className="text-xs text-slate-500">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="text-slate-100 whitespace-pre-wrap">
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
            <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
            Eliza is thinking...
          </div>
        )}
      </div>

      {/* Input Area */}
      {isConnected && (
        <div className="p-3 border-t border-slate-700">
          <div className="flex gap-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Eliza to help with your smart contract development..."
              className="flex-1 min-h-[60px] max-h-[120px] bg-slate-700 border-slate-600 text-slate-100 text-xs resize-none"
              disabled={isLoading}
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="h-8 w-8 p-0 bg-orange-600 hover:bg-orange-700"
              >
                <Send className="w-3 h-3" />
              </Button>
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="h-8 w-8 p-0 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <AlertCircle className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
