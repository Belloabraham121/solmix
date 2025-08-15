import { EventEmitter } from 'events';
import { MCPClient, MCPServerConfig, MCPServerConnection, MCPTool, MCPCallToolResult } from './mcp-client';
import { MCPServerRegistry, MCPServerInfo, getMCPServerRegistry } from './mcp-server-registry';

export interface ConnectionManagerConfig {
  maxConnections?: number;
  connectionTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
  autoReconnect?: boolean;
}

export interface ConnectionStatus {
  serverId: string;
  serverName: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  lastConnected?: Date;
  lastError?: string;
  retryCount: number;
  tools: MCPTool[];
  capabilities?: string[];
}

export interface ConnectionEvent {
  serverId: string;
  serverName: string;
  status: ConnectionStatus['status'];
  error?: Error;
  timestamp: Date;
}

export class MCPConnectionManager extends EventEmitter {
  private mcpClient: MCPClient;
  private registry: MCPServerRegistry;
  private connections: Map<string, ConnectionStatus> = new Map();
  private config: Required<ConnectionManagerConfig>;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ConnectionManagerConfig = {}) {
    super();
    
    this.config = {
      maxConnections: 10,
      connectionTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      healthCheckInterval: 60000, // 1 minute
      autoReconnect: true,
      ...config
    };

    this.mcpClient = new MCPClient({
      servers: [] // Will be populated dynamically
    });

    this.registry = getMCPServerRegistry();

    this.setupEventListeners();
    this.startHealthCheck();
  }

  private setupEventListeners(): void {
    // MCP Client events
    this.mcpClient.on('server_connected', (event) => {
      this.updateConnectionStatus(event.serverName, 'connected', {
        tools: event.tools || [],
        capabilities: event.capabilities
      });
      this.registry.updateServerStatus(event.serverName, true);
      this.emit('connection_established', {
        serverId: event.serverName,
        serverName: event.serverName,
        status: 'connected',
        timestamp: new Date()
      });
    });

    this.mcpClient.on('server_disconnected', (event) => {
      this.updateConnectionStatus(event.serverName, 'disconnected');
      this.registry.updateServerStatus(event.serverName, false);
      this.emit('connection_lost', {
        serverId: event.serverName,
        serverName: event.serverName,
        status: 'disconnected',
        timestamp: new Date()
      });

      // Auto-reconnect if enabled
      if (this.config.autoReconnect) {
        this.scheduleReconnect(event.serverName);
      }
    });

    this.mcpClient.on('error', (error) => {
      console.error('MCP Client error:', error);
      this.emit('connection_error', {
        serverId: 'unknown',
        serverName: 'unknown',
        status: 'error',
        error,
        timestamp: new Date()
      });
    });

    // Registry events
    this.registry.on('server_added', (server: MCPServerInfo) => {
      this.emit('server_discovered', server);
    });

    this.registry.on('server_removed', (server: MCPServerInfo) => {
      this.disconnect(server.id);
      this.emit('server_removed', server);
    });
  }

  public async connect(serverId: string): Promise<void> {
    const serverInfo = this.registry.getServer(serverId);
    if (!serverInfo) {
      throw new Error(`Server ${serverId} not found in registry`);
    }

    if (this.connections.size >= this.config.maxConnections) {
      throw new Error(`Maximum connections (${this.config.maxConnections}) reached`);
    }

    const existingConnection = this.connections.get(serverId);
    if (existingConnection && existingConnection.status === 'connected') {
      throw new Error(`Server ${serverId} is already connected`);
    }

    this.updateConnectionStatus(serverId, 'connecting');

    try {
      await this.mcpClient.addServer(serverInfo.config);
      // Connection status will be updated via event listeners
    } catch (error) {
      this.updateConnectionStatus(serverId, 'error', {
        lastError: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return; // Already disconnected or never connected
    }

    // Cancel any pending reconnect
    const reconnectTimeout = this.reconnectTimeouts.get(serverId);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      this.reconnectTimeouts.delete(serverId);
    }

    try {
      await this.mcpClient.removeServer(serverId);
      this.connections.delete(serverId);
      this.registry.updateServerStatus(serverId, false);
    } catch (error) {
      console.error(`Error disconnecting from ${serverId}:`, error);
      throw error;
    }
  }

  public async reconnect(serverId: string): Promise<void> {
    await this.disconnect(serverId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
    await this.connect(serverId);
  }

  public async connectMultiple(serverIds: string[]): Promise<void> {
    const results = await Promise.allSettled(
      serverIds.map(serverId => this.connect(serverId))
    );

    const failures = results
      .map((result, index) => ({ result, serverId: serverIds[index] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, serverId }) => ({ serverId, error: (result as PromiseRejectedResult).reason }));

    if (failures.length > 0) {
      console.warn('Some connections failed:', failures);
      this.emit('bulk_connection_completed', {
        successful: serverIds.length - failures.length,
        failed: failures.length,
        failures
      });
    }
  }

  public async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys());
    await Promise.allSettled(
      serverIds.map(serverId => this.disconnect(serverId))
    );
  }

  public getConnectionStatus(serverId: string): ConnectionStatus | undefined {
    return this.connections.get(serverId);
  }

  public getAllConnectionStatuses(): ConnectionStatus[] {
    return Array.from(this.connections.values());
  }

  public getConnectedServers(): ConnectionStatus[] {
    return this.getAllConnectionStatuses().filter(conn => conn.status === 'connected');
  }

  public getAvailableTools(): Array<MCPTool & { serverName: string }> {
    return this.mcpClient.getAllTools();
  }

  public async callTool(toolName: string, serverName: string, args: Record<string, any>): Promise<MCPCallToolResult> {
    const connection = Array.from(this.connections.values())
      .find(conn => conn.serverName === serverName && conn.status === 'connected');
    
    if (!connection) {
      throw new Error(`Server ${serverName} is not connected`);
    }

    const tool = connection.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverName}`);
    }

    try {
      return await this.mcpClient.callTool({
        toolName,
        serverName,
        arguments: args
      });
    } catch (error) {
      this.emit('tool_call_error', {
        toolName,
        serverName,
        error,
        timestamp: new Date()
      });
      throw error;
    }
  }

  public async getServerCapabilities(serverId: string): Promise<string[]> {
    const connection = this.connections.get(serverId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return connection.capabilities || [];
  }

  public getConnectionSummary(): {
    total: number;
    connected: number;
    connecting: number;
    disconnected: number;
    error: number;
    availableTools: number;
  } {
    const statuses = this.getAllConnectionStatuses();
    return {
      total: statuses.length,
      connected: statuses.filter(s => s.status === 'connected').length,
      connecting: statuses.filter(s => s.status === 'connecting').length,
      disconnected: statuses.filter(s => s.status === 'disconnected').length,
      error: statuses.filter(s => s.status === 'error').length,
      availableTools: this.getAvailableTools().length
    };
  }

  private updateConnectionStatus(
    serverId: string, 
    status: ConnectionStatus['status'], 
    updates: Partial<ConnectionStatus> = {}
  ): void {
    const existing = this.connections.get(serverId);
    const serverInfo = this.registry.getServer(serverId);
    
    const connectionStatus: ConnectionStatus = {
      serverId,
      serverName: serverInfo?.name || serverId,
      status,
      retryCount: existing?.retryCount || 0,
      tools: existing?.tools || [],
      ...updates
    };

    if (status === 'connected') {
      connectionStatus.lastConnected = new Date();
      connectionStatus.retryCount = 0;
    } else if (status === 'error') {
      connectionStatus.retryCount = (existing?.retryCount || 0) + 1;
    }

    this.connections.set(serverId, connectionStatus);
    this.emit('status_changed', connectionStatus);
  }

  private scheduleReconnect(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection || connection.retryCount >= this.config.retryAttempts) {
      return;
    }

    const delay = this.config.retryDelay * Math.pow(2, connection.retryCount); // Exponential backoff
    
    const timeout = setTimeout(async () => {
      this.reconnectTimeouts.delete(serverId);
      
      try {
        this.updateConnectionStatus(serverId, 'reconnecting');
        await this.connect(serverId);
      } catch (error) {
        console.error(`Reconnection attempt failed for ${serverId}:`, error);
        this.scheduleReconnect(serverId); // Schedule next attempt
      }
    }, delay);

    this.reconnectTimeouts.set(serverId, timeout);
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const connectedServers = this.getConnectedServers();
      
      for (const connection of connectedServers) {
        try {
          // Simple health check by listing tools
          const tools = this.mcpClient.getServerTools(connection.serverName);
          if (tools.length !== connection.tools.length) {
            // Tools changed, update connection
            this.updateConnectionStatus(connection.serverId, 'connected', { tools });
          }
        } catch (error) {
          console.warn(`Health check failed for ${connection.serverName}:`, error);
          this.updateConnectionStatus(connection.serverId, 'error', {
            lastError: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }, this.config.healthCheckInterval);
  }

  public async exportConnections(): Promise<string> {
    const connectedServers = this.getConnectedServers();
    const config = {
      mcpServers: Object.fromEntries(
        connectedServers.map(conn => {
          const serverInfo = this.registry.getServer(conn.serverId);
          return [conn.serverId, serverInfo?.config];
        }).filter(([_, config]) => config)
      )
    };
    return JSON.stringify(config, null, 2);
  }

  public async importConnections(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);
      if (config.mcpServers) {
        const serverIds = Object.keys(config.mcpServers);
        await this.connectMultiple(serverIds);
      }
    } catch (error) {
      throw new Error(`Failed to import connections: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public destroy(): void {
    // Clear all timeouts
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
    this.reconnectTimeouts.clear();

    // Disconnect all servers
    this.disconnectAll().catch(console.error);

    // Clean up
    this.connections.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let connectionManagerInstance: MCPConnectionManager | null = null;

export function getMCPConnectionManager(config?: ConnectionManagerConfig): MCPConnectionManager {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new MCPConnectionManager(config);
  }
  return connectionManagerInstance;
}

export function resetMCPConnectionManager(): void {
  if (connectionManagerInstance) {
    connectionManagerInstance.destroy();
    connectionManagerInstance = null;
  }
}