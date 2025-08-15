import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface MCPClientConfig {
  servers: MCPServerConfig[];
}

export interface MCPMessage {
  id: string;
  type: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: Date;
  serverName?: string;
  toolName?: string;
}

export interface MCPToolCall {
  toolName: string;
  serverName: string;
  arguments: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPCallToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export interface MCPServerConnection {
  name: string;
  process: ChildProcess;
  tools: MCPTool[];
  connected: boolean;
  messageId: number;
}

export class MCPClient extends EventEmitter {
  private connections: Map<string, MCPServerConnection> = new Map();
  private config: MCPClientConfig;
  private isInitialized = false;

  constructor(config: MCPClientConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error("MCP Client already initialized");
    }

    this.emit("status", {
      type: "initializing",
      message: "Initializing MCP Client...",
    });

    try {
      // Connect to all configured servers
      const connectionPromises = this.config.servers.map((server) =>
        this.connectToServer(server)
      );

      await Promise.allSettled(connectionPromises);
      this.isInitialized = true;

      this.emit("status", {
        type: "initialized",
        message: `MCP Client initialized with ${this.connections.size} server(s)`,
        connectedServers: Array.from(this.connections.keys()),
      });
    } catch (error) {
      this.emit("error", { type: "initialization_failed", error });
      throw error;
    }
  }

  private async connectToServer(
    serverConfig: MCPServerConfig,
    retryCount = 0
  ): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    try {
      this.emit("status", {
        type: "connecting",
        message: `Connecting to ${serverConfig.name}... (attempt ${
          retryCount + 1
        }/${maxRetries + 1})`,
        serverName: serverConfig.name,
      });

      // Spawn the server process
      const serverProcess = spawn(serverConfig.command, serverConfig.args, {
        env: { ...process.env, ...serverConfig.env },
        cwd: serverConfig.cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const connection: MCPServerConnection = {
        name: serverConfig.name,
        process: serverProcess,
        tools: [],
        connected: false,
        messageId: 1,
      };

      // Handle process events
      serverProcess.on("error", (error: Error) => {
        this.emit("error", {
          type: "connection_failed",
          serverName: serverConfig.name,
          error: error.message,
        });
      });

      serverProcess.stderr?.on("data", (data: Buffer) => {
        console.error(`${serverConfig.name} stderr:`, data.toString());
      });

      // Initialize the connection
      await this.initializeConnection(connection);

      this.connections.set(serverConfig.name, connection);

      this.emit("server_connected", {
        serverName: serverConfig.name,
        tools: connection.tools.map((t) => ({
          name: t.name,
          description: t.description,
        })),
      });

      this.emit("status", {
        type: "server_connected",
        message: `Connected to ${serverConfig.name} with ${connection.tools.length} tool(s)`,
        serverName: serverConfig.name,
        toolCount: connection.tools.length,
      });
    } catch (error) {
      console.error(
        `Failed to connect to ${serverConfig.name} (attempt ${
          retryCount + 1
        }):`,
        error
      );

      // Clean up failed connection
      this.connections.delete(serverConfig.name);

      // Retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        console.log(
          `Retrying connection to ${serverConfig.name} in ${retryDelay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return this.connectToServer(serverConfig, retryCount + 1);
      } else {
        console.error(
          `Failed to connect to ${serverConfig.name} after ${
            maxRetries + 1
          } attempts`
        );
        this.emit("error", {
          type: "connection_failed",
          serverName: serverConfig.name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }

  private async initializeConnection(
    connection: MCPServerConnection
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Connection timeout for ${connection.name} - server may not be responding`
          )
        );
      }, 15000); // Increased timeout to 15 seconds

      let buffer = "";
      let initializationStarted = false;

      // Handle stdout data
      connection.process.stdout?.on("data", (data) => {
        buffer += data.toString();

        // Process complete JSON-RPC messages
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              this.handleMessage(connection, message);
            } catch (error) {
              console.error(
                `Failed to parse message from ${connection.name}:`,
                line,
                error
              );
            }
          }
        }
      });

      // Handle stderr for debugging
      connection.process.stderr?.on("data", (data) => {
        const errorOutput = data.toString();
        console.warn(`${connection.name} stderr:`, errorOutput);

        // Check for common error patterns
        if (errorOutput.includes("Wallet functionality is disabled")) {
          console.log(
            `${connection.name}: Wallet functionality disabled - this may be expected`
          );
        }
      });

      // Handle process errors
      connection.process.on("error", (error) => {
        clearTimeout(timeout);
        reject(
          new Error(`Process error for ${connection.name}: ${error.message}`)
        );
      });

      // Handle process exit
      connection.process.on("exit", (code, signal) => {
        if (!connection.connected) {
          clearTimeout(timeout);
          reject(
            new Error(
              `${connection.name} process exited with code ${code} and signal ${signal}`
            )
          );
        }
      });

      // Listen for successful connection
      const onConnected = (serverName: string) => {
        if (serverName === connection.name) {
          clearTimeout(timeout);
          this.removeListener("serverConnected", onConnected);
          resolve();
        }
      };
      this.on("serverConnected", onConnected);

      // Send initialize request
      const initMessage = {
        jsonrpc: "2.0",
        id: connection.messageId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            experimental: {},
          },
          clientInfo: {
            name: "solmix-mcp-client",
            version: "1.0.0",
          },
        },
      };

      try {
        connection.process.stdin?.write(JSON.stringify(initMessage) + "\n");
        initializationStarted = true;
        console.log(`Sent initialize request to ${connection.name}`);
      } catch (error) {
        clearTimeout(timeout);
        reject(
          new Error(
            `Failed to send initialize request to ${connection.name}: ${error}`
          )
        );
      }
    });
  }

  private handleMessage(connection: MCPServerConnection, message: any): void {
    // Handle initialize response
    if (message.id && message.result && !message.method) {
      // This is a response to our initialize request
      if (!connection.connected) {
        // Server initialized, now list tools
        const listToolsMessage = {
          jsonrpc: "2.0",
          id: connection.messageId++,
          method: "tools/list",
          params: {},
        };

        connection.process.stdin?.write(
          JSON.stringify(listToolsMessage) + "\n"
        );
      }
    }
    // Handle tools/list response
    else if (
      message.id &&
      message.result &&
      message.result.tools !== undefined
    ) {
      // Tools listed
      connection.tools = message.result.tools || [];
      connection.connected = true;
      this.emit("serverConnected", connection.name);
      console.log(
        `Successfully connected to ${connection.name} with ${connection.tools.length} tools`
      );
    }
    // Handle errors
    else if (message.error) {
      console.error(`Error from ${connection.name}:`, message.error);
      this.emit("serverError", connection.name, message.error);
    }
    // Handle notifications
    else if (message.method && !message.id) {
      console.log(
        `Notification from ${connection.name}:`,
        message.method,
        message.params
      );
    }
  }

  async callTool(toolCall: MCPToolCall): Promise<MCPCallToolResult> {
    const connection = this.connections.get(toolCall.serverName);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${toolCall.serverName} is not connected`);
    }

    return new Promise((resolve, reject) => {
      const messageId = connection.messageId++;
      const timeout = setTimeout(() => {
        reject(new Error("Tool call timeout"));
      }, 30000);

      const handleResponse = (data: Buffer) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              if (message.id === messageId && message.result) {
                clearTimeout(timeout);
                connection.process.stdout?.off("data", handleResponse);
                resolve(message.result);
                return;
              } else if (message.id === messageId && message.error) {
                clearTimeout(timeout);
                connection.process.stdout?.off("data", handleResponse);
                reject(new Error(message.error.message || "Tool call failed"));
                return;
              }
            } catch (error) {
              // Ignore parse errors for partial messages
            }
          }
        }
      };

      connection.process.stdout?.on("data", handleResponse);

      try {
        this.emit("tool_call_start", {
          toolName: toolCall.toolName,
          serverName: toolCall.serverName,
          arguments: toolCall.arguments,
        });

        const callMessage = {
          jsonrpc: "2.0",
          id: messageId,
          method: "tools/call",
          params: {
            name: toolCall.toolName,
            arguments: toolCall.arguments,
          },
        };

        connection.process.stdin?.write(JSON.stringify(callMessage) + "\n");
      } catch (error) {
        clearTimeout(timeout);
        connection.process.stdout?.off("data", handleResponse);
        this.emit("tool_call_error", {
          toolName: toolCall.toolName,
          serverName: toolCall.serverName,
          error: error instanceof Error ? error.message : String(error),
        });
        reject(error);
      }
    });
  }

  getAllTools(): Array<MCPTool & { serverName: string }> {
    const allTools: Array<MCPTool & { serverName: string }> = [];

    for (const [serverName, connection] of this.connections) {
      if (connection.connected) {
        for (const tool of connection.tools) {
          allTools.push({ ...tool, serverName });
        }
      }
    }

    return allTools;
  }

  getServerTools(serverName: string): MCPTool[] {
    const connection = this.connections.get(serverName);
    return connection?.tools || [];
  }

  getConnectedServers(): string[] {
    return Array.from(this.connections.keys()).filter(
      (name) => this.connections.get(name)?.connected
    );
  }

  isServerConnected(serverName: string): boolean {
    const connection = this.connections.get(serverName);
    return connection?.connected || false;
  }

  async disconnectServer(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Server ${serverName} not found`);
    }

    try {
      if (connection.process) {
        connection.process.kill();
      }

      connection.connected = false;
      this.connections.delete(serverName);

      this.emit("server_disconnected", { serverName });
      this.emit("status", {
        type: "server_disconnected",
        message: `Disconnected from ${serverName}`,
        serverName,
      });
    } catch (error) {
      this.emit("error", {
        type: "disconnection_failed",
        serverName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const disconnectionPromises = Array.from(this.connections.keys()).map(
      (serverName) => this.disconnectServer(serverName)
    );

    await Promise.allSettled(disconnectionPromises);
    this.connections.clear();
    this.isInitialized = false;

    this.emit("status", {
      type: "disconnected",
      message: "MCP Client disconnected from all servers",
    });
  }

  async addServer(serverConfig: MCPServerConfig): Promise<void> {
    if (this.connections.has(serverConfig.name)) {
      throw new Error(`Server ${serverConfig.name} already exists`);
    }

    this.config.servers.push(serverConfig);
    await this.connectToServer(serverConfig);
  }

  async removeServer(serverName: string): Promise<void> {
    await this.disconnectServer(serverName);
    this.config.servers = this.config.servers.filter(
      (s) => s.name !== serverName
    );
  }

  getStatus(): {
    initialized: boolean;
    connectedServers: number;
    totalTools: number;
    servers: Array<{
      name: string;
      connected: boolean;
      toolCount: number;
    }>;
  } {
    const servers = Array.from(this.connections.entries()).map(
      ([name, connection]) => ({
        name,
        connected: connection.connected,
        toolCount: connection.tools.length,
      })
    );

    return {
      initialized: this.isInitialized,
      connectedServers: servers.filter((s) => s.connected).length,
      totalTools: servers.reduce(
        (sum, s) => sum + (s.connected ? s.toolCount : 0),
        0
      ),
      servers,
    };
  }
}

// Utility function to create MCP client from JSON config
export function createMCPClientFromConfig(configJson: string): MCPClient {
  try {
    const config = JSON.parse(configJson);

    if (!config.mcpServers || typeof config.mcpServers !== "object") {
      throw new Error("Invalid config: mcpServers object is required");
    }

    const servers: MCPServerConfig[] = Object.entries(config.mcpServers).map(
      ([name, serverConfig]: [string, any]) => ({
        name,
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {},
        cwd: serverConfig.cwd,
      })
    );

    return new MCPClient({ servers });
  } catch (error) {
    throw new Error(
      `Failed to parse MCP config: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
