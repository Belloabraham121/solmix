"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface MCPContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  serverStatus: {
    connectedServers: number;
    totalServers: number;
    servers: any[];
  };
}

const MCPContext = createContext<MCPContextType>({
  isInitialized: false,
  isInitializing: false,
  error: null,
  serverStatus: {
    connectedServers: 0,
    totalServers: 0,
    servers: [],
  },
});

export const useMCP = () => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error("useMCP must be used within a MCPProvider");
  }
  return context;
};

interface MCPProviderProps {
  children: React.ReactNode;
}

export function MCPProvider({ children }: MCPProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState({
    connectedServers: 0,
    totalServers: 0,
    servers: [],
  });

  useEffect(() => {
    const initializeMCP = async () => {
      if (isInitializing || isInitialized) {
        return;
      }

      setIsInitializing(true);
      setError(null);

      try {
        console.log("Checking MCP client status...");

        // First, check if MCP is already initialized
        const initialStatusResponse = await fetch("/api/mcp/status");
        const initialStatusResult = await initialStatusResponse.json();

        if (
          initialStatusResult.success &&
          initialStatusResult.data.status.initialized
        ) {
          console.log(
            "MCP client already initialized, using existing instance"
          );
          setServerStatus({
            connectedServers: initialStatusResult.data.status.connectedServers,
            totalServers: initialStatusResult.data.status.totalServers,
            servers: initialStatusResult.data.servers,
          });
          setIsInitialized(true);
          return;
        }

        console.log("Initializing MCP client via API...");

        // Only initialize if not already initialized
        const initResponse = await fetch("/api/mcp/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const initResult = await initResponse.json();
        console.log("MCP init result:", initResult);

        if (!initResult.success) {
          throw new Error(
            `Failed to initialize MCP client: ${initResult.error}`
          );
        }

        // Wait a moment for servers to connect
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Then get the current status
        const statusResponse = await fetch("/api/mcp/status");
        
        // Check if response is actually JSON
        const contentType = statusResponse.headers.get('content-type');
        console.log('MCP Status API Response (init):', {
          status: statusResponse.status,
          statusText: statusResponse.statusText,
          contentType,
          url: statusResponse.url
        });
        
        if (!statusResponse.ok) {
          throw new Error(`HTTP ${statusResponse.status}: ${statusResponse.statusText}`);
        }
        
        if (!contentType || !contentType.includes('application/json')) {
          const text = await statusResponse.text();
          console.error('Expected JSON but got:', text.substring(0, 200));
          throw new Error('API returned non-JSON response');
        }
        
        const statusResult = await statusResponse.json();

        if (statusResult.success) {
          setServerStatus({
            connectedServers: statusResult.data.status.connectedServers,
            totalServers: statusResult.data.status.totalServers,
            servers: statusResult.data.servers,
          });
          setIsInitialized(true);
          console.log(
            "MCP client initialized and status retrieved successfully"
          );
        } else {
          throw new Error("Failed to get MCP status after initialization");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to initialize MCP client:", errorMessage);
        setError(errorMessage);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeMCP();

    // Set up polling to check server status
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/mcp/status");
        
        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {
          console.error(`Polling failed: HTTP ${response.status}: ${response.statusText}`);
          return;
        }
        
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Polling expected JSON but got:', text.substring(0, 200));
          return;
        }
        
        const result = await response.json();

        if (result.success) {
          setServerStatus({
            connectedServers: result.data.status.connectedServers,
            totalServers: result.data.status.totalServers,
            servers: result.data.servers,
          });
        }
      } catch (err) {
        console.error("Failed to poll MCP status:", err);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  const contextValue: MCPContextType = {
    isInitialized,
    isInitializing,
    error,
    serverStatus,
  };

  return (
    <MCPContext.Provider value={contextValue}>{children}</MCPContext.Provider>
  );
}

export default MCPProvider;
