import { NextRequest, NextResponse } from "next/server";
import { MCPClient } from "@/lib/mcp-client";
import MCPClientSingleton from "@/lib/mcp-singleton";
import { AgentRuntime, validateCharacter } from "@elizaos/core";
import { googleGenAIPlugin } from "@elizaos/plugin-google-genai";
import fs from "fs";
import path from "path";

// Global instances
let mcpClient: MCPClient | null = null;
let elizaAgent: any = null;
let elizaRuntime: any = null;

// Load Eliza configuration
function loadElizaConfig() {
  try {
    const configPath = path.join(process.cwd(), "eliza-config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config;
  } catch (error) {
    console.error("Failed to load Eliza config:", error);
    return null;
  }
}

// Initialize Eliza agent with MCP plugin
async function initializeElizaAgent() {
  try {
    const config = loadElizaConfig();
    if (!config) {
      throw new Error("Failed to load Eliza configuration");
    }

    // Create character from config
    const character = {
      ...config.character,
      settings: {
        secrets: {
          GOOGLE_GENAI_API_KEY:
            process.env.GOOGLE_GENAI_API_KEY ||
            config.settings.googleGenAI.apiKey,
        },
        ...config.settings,
      },
    };

    // Validate character
    const isValid = validateCharacter(character);
    if (!isValid) {
      throw new Error("Invalid character configuration");
    }

    // Create runtime with Google GenAI plugin (MCP handled separately)
    elizaRuntime = new AgentRuntime({
      databaseAdapter: null, // Use in-memory for now
      token: process.env.ELIZA_TOKEN || "default-token",
      character: character,
      plugins: [googleGenAIPlugin],
    });

    console.log("Eliza agent initialized successfully!");
    console.log("Character:", character.name);
    console.log("Plugins loaded:", ["googleGenAI"]);
    console.log(
      "MCP servers configured:",
      Object.keys(character.settings?.mcp?.servers || {})
    );

    return elizaRuntime;
  } catch (error) {
    console.error("Failed to initialize Eliza agent:", error);
    throw error;
  }
}

// Default MCP configuration
const defaultMCPConfig = {
  mcpServers: {
    "sei-mcp-server": {
      command: "npx",
      args: ["-y", "@sei-js/mcp-server"],
      env: {
        PRIVATE_KEY: process.env.SEI_PRIVATE_KEY || "your_private_key_here",
      },
    },
  },
};

// Helper function to process messages with Eliza runtime
async function processWithElizaRuntime(
  message: string,
  elizaRuntime: any,
  mcpClient: any,
  mcpContext?: any
): Promise<string> {
  try {
    // Create a proper message object for Eliza
    const messageObj = {
      content: {
        text: message,
      },
      userId: "user",
      roomId: "solmix-ide",
      agentId: elizaRuntime.agentId,
    };

    // Compose state for response generation
    const state = await elizaRuntime.composeState(messageObj);

    // Process actions based on the message and state
    const actions = await elizaRuntime.processActions(
      messageObj,
      [],
      state,
      async () => {
        // This callback can be used for additional processing
        return [];
      }
    );

    // Extract the text response from Eliza's actions
    if (actions && actions.length > 0) {
      for (const action of actions) {
        if (action.content && action.content.text) {
          return action.content.text;
        }
      }
    }

    // If no actions generated a response, try to generate one using the model provider
    const modelProvider = elizaRuntime.getService("model");
    if (modelProvider) {
      const response = await modelProvider.generateText({
        context: state.text || message,
        stop: [],
        max_response_length: 1000,
      });

      if (response && response.text) {
        return response.text;
      }
    }

    // Fallback if no proper response
    return "I'm ready to help you with your development tasks. What would you like me to do?";
  } catch (error) {
    console.error("Error processing message with Eliza runtime:", error);
    throw error;
  }
}

// Helper function to check if MCP tools should be called based on message content
async function shouldCallMCPTool(
  message: string,
  mcpClient: any
): Promise<{
  shouldCall: boolean;
  toolName?: string;
  serverName?: string;
  args?: any;
}> {
  const lowerMessage = message.toLowerCase();

  try {
    const tools = await mcpClient.listTools();

    // Check for balance-related queries
    if (lowerMessage.includes("balance") || lowerMessage.includes("wallet")) {
      const balanceTool = tools.find((tool: any) => tool.name === "balance");
      if (balanceTool) {
        return {
          shouldCall: true,
          toolName: "balance",
          serverName: "sei-mcp-server",
          args: {},
        };
      }
    }

    // Check for other tool-specific queries
    if (lowerMessage.includes("deploy") && lowerMessage.includes("contract")) {
      const deployTool = tools.find((tool: any) =>
        tool.name.includes("deploy")
      );
      if (deployTool) {
        return {
          shouldCall: true,
          toolName: deployTool.name,
          serverName: "sei-mcp-server",
          args: {},
        };
      }
    }
  } catch (error) {
    console.error("Error checking MCP tools:", error);
  }

  return { shouldCall: false };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, message, config } = body;

    switch (action) {
      case "connect":
        try {
          console.log("Initializing Eliza agent with MCP plugin...");

          // Initialize the actual Eliza agent with MCP plugin
          elizaRuntime = await initializeElizaAgent();

          // Also get the MCP client for direct tool access
          mcpClient = await MCPClientSingleton.getInstance();
          console.log("MCP client instance:", mcpClient.instanceId);

          // Set up event listeners
          mcpClient.on("status", (status) => {
            console.log("MCP Status:", status);
          });

          mcpClient.on("error", (error) => {
            console.error("MCP Error:", error);
          });

          mcpClient.on("server_connected", (event) => {
            console.log("MCP Server Connected:", event);
          });

          // Get available tools from MCP client
          const availableTools = mcpClient.getAllTools();
          console.log("Available tools:", availableTools);

          // Create Eliza agent info
          elizaAgent = {
            id: "eliza-" + Date.now(),
            name: "Eliza AI Agent",
            capabilities: [
              "smart-contract-analysis",
              "code-review",
              "deployment-guidance",
              "mcp-tool-execution",
            ],
            mcpIntegration: true,
            elizaRuntime: true,
            connectedServers: mcpClient.getConnectedServers(),
            availableTools: availableTools,
          };

          return NextResponse.json({
            success: true,
            message:
              "Successfully connected to Eliza agent with MCP plugin integration",
            agent: elizaAgent,
            mcpStatus: mcpClient.getStatus(),
          });
        } catch (error) {
          console.error("Connection error:", error);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to connect: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
            { status: 500 }
          );
        }

      case "disconnect":
        try {
          if (mcpClient) {
            await mcpClient.disconnect();
            mcpClient = null;
          }
          elizaAgent = null;

          return NextResponse.json({
            success: true,
            message:
              "Successfully disconnected from Eliza agent and MCP servers",
          });
        } catch (error) {
          console.error("Disconnection error:", error);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to disconnect: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
            { status: 500 }
          );
        }

      case "send":
        try {
          if (!elizaAgent || !mcpClient || !elizaRuntime) {
            return NextResponse.json(
              {
                success: false,
                error: "Eliza agent is not connected. Please connect first.",
              },
              { status: 400 }
            );
          }

          if (!message) {
            return NextResponse.json(
              {
                success: false,
                error: "Message is required",
              },
              { status: 400 }
            );
          }

          // Extract MCP context from request
          const { mcpContext } = body;

          console.log("Processing message with Eliza runtime:", message);
          console.log("MCP context:", mcpContext);

          let response = "";

          try {
            console.log("Eliza runtime available:", !!elizaRuntime);

            // Check if we should call an MCP tool first
            const toolCheck = await shouldCallMCPTool(message, mcpClient);

            if (toolCheck.shouldCall) {
              console.log(`Calling MCP tool: ${toolCheck.toolName}`);

              // Call the MCP tool
              const toolResult = await mcpClient.callTool({
                toolName: toolCheck.toolName!,
                serverName: toolCheck.serverName!,
                arguments: toolCheck.args || {},
              });

              // Create enhanced message with tool result for Eliza
              const enhancedMessage = `${message}\n\nMCP Tool Result from ${
                toolCheck.toolName
              }: ${JSON.stringify(toolResult, null, 2)}`;

              // Process with Eliza runtime including tool result
              response = await processWithElizaRuntime(
                enhancedMessage,
                elizaRuntime,
                mcpClient,
                mcpContext
              );
            } else {
              // Process normally with Eliza runtime
              response = await processWithElizaRuntime(
                message,
                elizaRuntime,
                mcpClient,
                mcpContext
              );
            }
          } catch (elizaError) {
            console.error("Eliza runtime error:", elizaError);
            // Fallback response
            response =
              "I apologize, but I encountered an error processing your message. Please try again.";
          }

          return NextResponse.json({
            success: true,
            message: response,
            agent: elizaAgent,
            mcpStatus: mcpClient.getStatus(),
          });
        } catch (error) {
          console.error("Message processing error:", error);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to process message: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
            { status: 500 }
          );
        }

      case "status":
        return NextResponse.json({
          success: true,
          connected: !!elizaAgent,
          agent: elizaAgent,
          mcpStatus: mcpClient?.getStatus() || null,
        });

      case "call_tool":
        try {
          const { toolName, serverName, arguments: toolArgs } = body;

          if (!toolName || !serverName) {
            return NextResponse.json(
              {
                success: false,
                error: "Tool name and server name are required",
              },
              { status: 400 }
            );
          }

          if (!elizaAgent || !mcpClient || !elizaRuntime) {
            return NextResponse.json(
              {
                success: false,
                error: "Eliza agent with MCP plugin is not connected",
              },
              { status: 400 }
            );
          }

          console.log(
            `Eliza agent calling MCP tool: ${toolName} on ${serverName}`
          );
          console.log("Tool arguments:", toolArgs);

          const result = await mcpClient.callTool({
            toolName,
            serverName,
            arguments: toolArgs || {},
          });

          console.log("Tool execution result:", result);

          return NextResponse.json({
            success: true,
            result,
            message: `Tool '${toolName}' executed successfully via Eliza agent with MCP plugin`,
            mcpStatus: mcpClient.getStatus(),
          });
        } catch (error) {
          console.error("Eliza MCP tool call error:", error);
          return NextResponse.json(
            {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
              details:
                "Error occurred while Eliza agent was executing MCP tool",
            },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    connected: !!elizaAgent,
    agent: elizaAgent,
    mcpStatus: mcpClient?.getStatus() || null,
    endpoints: {
      connect: 'POST /api/eliza with action: "connect"',
      disconnect: 'POST /api/eliza with action: "disconnect"',
      send: 'POST /api/eliza with action: "send" and message',
      status: 'POST /api/eliza with action: "status"',
      call_tool:
        'POST /api/eliza with action: "call_tool", toolName, serverName, arguments',
    },
  });
}
