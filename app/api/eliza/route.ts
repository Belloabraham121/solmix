console.log("[ROUTE] Eliza route file loaded - TEST");

import { NextRequest, NextResponse } from "next/server";
import { MCPClient } from "@/lib/mcp-client";
import MCPClientSingleton from "@/lib/mcp-singleton";
import { AgentRuntime, validateCharacter } from "@elizaos/core";
import { googleGenAIPlugin } from "@elizaos/plugin-google-genai";
import seiPlugin from "@/lib/eliza-sei-plugin.js";
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

// Use MCP tools for SEI queries instead of the separate plugin
async function processMessageWithMCPTools(
  message: string,
  mcpClient: any
): Promise<{ response: string; usedMCP: boolean }> {
  console.log(`[MCP Tools] Processing message: "${message}"`);

  const lowerMessage = message.toLowerCase();

  // Check for balance queries
  const hasBalanceKeywords =
    /\b(balance|bal|funds|amount|how much|what.*have)\b/i.test(message);
  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);

  if (hasBalanceKeywords && addressMatch) {
    const address = addressMatch[0];
    console.log(`[MCP Tools] Balance query detected for address: ${address}`);

    try {
      // Call the MCP get_balance tool directly
      const toolResult = await mcpClient.callTool({
        toolName: "get_balance",
        serverName: "sei-mcp-server",
        arguments: {
          address: address,
          network: "sei",
        },
      });

      console.log(`[MCP Tools] Balance tool result:`, toolResult);

      // Parse the result
      let balanceText = `Unable to fetch balance for address ${address}`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        const resultText = toolResult.content[0].text;
        console.log(`[MCP Tools] Raw result text:`, resultText);

        try {
          const balanceData = JSON.parse(resultText);
          const balance =
            balanceData.ether || balanceData.balance || balanceData.wei || "0";
          balanceText = `The balance for address ${address} is ${balance} SEI`;
        } catch (parseError) {
          // If JSON parsing fails, use the raw text
          balanceText = `Balance result: ${resultText}`;
        }
      }

      return {
        response: balanceText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Balance query error:", error);
      return {
        response: `Sorry, I couldn't fetch the balance. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  // Check for documentation search queries
  if (
    lowerMessage.includes("search") &&
    (lowerMessage.includes("doc") ||
      lowerMessage.includes("staking") ||
      lowerMessage.includes("sei"))
  ) {
    const searchQuery = message
      .replace(/search|docs|documentation|for|about|sei/gi, "")
      .trim();
    console.log(
      `[MCP Tools] Documentation search detected for: ${searchQuery}`
    );

    try {
      const toolResult = await mcpClient.callTool({
        toolName: "search_docs",
        serverName: "sei-mcp-server",
        arguments: {
          query: searchQuery || "staking",
        },
      });

      console.log(`[MCP Tools] Docs search result:`, toolResult);

      let searchText = `Unable to find documentation for "${searchQuery}"`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        searchText = `Here's what I found in the Sei documentation:\n\n${toolResult.content[0].text}`;
      }

      return {
        response: searchText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Docs search error:", error);
      return {
        response: `Sorry, I couldn't search the documentation. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  // Check for block queries
  if (
    (lowerMessage.includes("block") || lowerMessage.includes("latest")) &&
    !lowerMessage.includes("balance")
  ) {
    console.log(`[MCP Tools] Block query detected`);

    try {
      const toolResult = await mcpClient.callTool({
        toolName: "get_latest_block",
        serverName: "sei-mcp-server",
        arguments: {
          network: "sei",
        },
      });

      console.log(`[MCP Tools] Block result:`, toolResult);

      let blockText = `Unable to fetch latest block information`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        const blockData = JSON.parse(toolResult.content[0].text);
        blockText = `Latest Sei Block Information:\n\nBlock Number: ${
          blockData.number
        }\nBlock Hash: ${blockData.hash}\nMiner: ${
          blockData.miner
        }\nGas Used: ${blockData.gasUsed}\nTransactions: ${
          blockData.transactions.length
        }\nTimestamp: ${new Date(
          parseInt(blockData.timestamp) * 1000
        ).toLocaleString()}`;
      }

      return {
        response: blockText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Block query error:", error);
      return {
        response: `Sorry, I couldn't fetch block information. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  // Check for chain info queries
  if (
    lowerMessage.includes("chain") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("info")
  ) {
    console.log(`[MCP Tools] Chain info query detected`);

    try {
      const toolResult = await mcpClient.callTool({
        toolName: "get_chain_info",
        serverName: "sei-mcp-server",
        arguments: {
          network: "sei",
        },
      });

      console.log(`[MCP Tools] Chain info result:`, toolResult);

      let chainText = `Unable to fetch chain information`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        const chainData = JSON.parse(toolResult.content[0].text);
        chainText = `Sei Network Information:\n\nNetwork: ${chainData.network}\nChain ID: ${chainData.chainId}\nLatest Block: ${chainData.blockNumber}\nRPC URL: ${chainData.rpcUrl}`;
      }

      return {
        response: chainText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Chain info error:", error);
      return {
        response: `Sorry, I couldn't fetch chain information. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  // Check for file system queries
  if (
    lowerMessage.includes("file") ||
    lowerMessage.includes("directory") ||
    lowerMessage.includes("list")
  ) {
    console.log(`[MCP Tools] Filesystem query detected`);

    try {
      const toolResult = await mcpClient.callTool({
        toolName: "list_directory",
        serverName: "filesystem-server",
        arguments: {
          path: ".",
        },
      });

      console.log(`[MCP Tools] Filesystem result:`, toolResult);

      let fileText = `Unable to list directory contents`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        fileText = `Directory contents:\n\n${toolResult.content[0].text}`;
      }

      return {
        response: fileText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Filesystem error:", error);
      return {
        response: `Sorry, I couldn't access the filesystem. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  return { response: "", usedMCP: false };
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
  // First, try our SEI plugin for balance queries
  console.log(`[shouldCallMCPTool] Checking if message should use SEI plugin`);

  const lowerMessage = message.toLowerCase();
  const hasBalanceKeywords =
    /\b(balance|bal|funds|amount|how much|what.*have)\b/i.test(message);
  const hasAddress = /0x[a-fA-F0-9]{40}/.test(message);

  if (hasBalanceKeywords && hasAddress) {
    console.log(
      `[shouldCallMCPTool] Balance query detected - will be handled by SEI plugin`
    );
    return { shouldCall: false }; // Let SEI plugin handle it
  }

  // Fallback to other tools...
  console.log(`[shouldCallMCPTool] Processing message: "${message}"`);
  console.log(`[shouldCallMCPTool] Lowercase message: "${lowerMessage}"`);

  try {
    const tools = await mcpClient.getAllTools();
    console.log(
      `[shouldCallMCPTool] Retrieved ${tools.length} tools:`,
      tools.map((t: any) => `${t.name} (${t.serverName})`)
    );

    // Check for ERC20 token balance queries
    if (lowerMessage.includes("token") && lowerMessage.includes("balance")) {
      const addressMatches = message.match(/0x[a-fA-F0-9]{40}/g);
      if (addressMatches && addressMatches.length >= 2) {
        const tokenBalanceTool = tools.find(
          (tool: any) => tool.name === "get_token_balance"
        );
        if (tokenBalanceTool) {
          return {
            shouldCall: true,
            toolName: "get_token_balance",
            serverName: "sei-mcp-server",
            args: {
              tokenAddress: addressMatches[0],
              ownerAddress: addressMatches[1],
            },
          };
        }
      }
    }

    // Check for transaction queries
    if (lowerMessage.includes("transaction") || lowerMessage.includes("tx")) {
      const txHashMatch = message.match(/0x[a-fA-F0-9]{64}/);
      if (txHashMatch) {
        const txHash = txHashMatch[0];
        const txTool = tools.find(
          (tool: any) => tool.name === "get_transaction"
        );
        if (txTool) {
          return {
            shouldCall: true,
            toolName: "get_transaction",
            serverName: "sei-mcp-server",
            args: { txHash },
          };
        }
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
  console.log("\n🚀🚀🚀 [ELIZA-POST] POST function called! 🚀🚀🚀");
  try {
    const body = await request.json();
    console.log("🔍 [ELIZA-POST] Request body:", JSON.stringify(body, null, 2));
    const { action, message, config } = body;
    console.log("⚡ [ELIZA-POST] Action:", action, "Message:", message);

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
      case "message":
        console.log(
          "[POST] Received send/message request with message:",
          message
        );
        try {
          if (!elizaAgent || !mcpClient || !elizaRuntime) {
            console.log(
              "[POST] Missing components - elizaAgent:",
              !!elizaAgent,
              "mcpClient:",
              !!mcpClient,
              "elizaRuntime:",
              !!elizaRuntime
            );
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

            // First, try MCP tools for blockchain queries
            console.log("Trying MCP tools first...");
            const mcpResult = await processMessageWithMCPTools(
              message,
              mcpClient
            );
            console.log("MCP tools result:", mcpResult);

            if (mcpResult.usedMCP) {
              console.log(
                "MCP tools handled the message, now processing through AI..."
              );

              // Try direct Google GenAI integration first
              console.log("Attempting direct Google GenAI processing...");

              try {
                // Check if API key is available
                const apiKey =
                  process.env.GOOGLE_GENAI_API_KEY ||
                  "AIzaSyBUC7fcpxGlnxJ6qlt0LerVkxpaZrURE0k";
                console.log(
                  "Google GenAI API Key available:",
                  apiKey ? "YES" : "NO"
                );

                if (!apiKey) {
                  throw new Error("Google GenAI API key not found");
                }

                // Direct Google GenAI API call
                const { GoogleGenerativeAI } = await import(
                  "@google/generative-ai"
                );
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-pro" });

                const prompt = `User asked: "${message}"

I retrieved this blockchain data:
${mcpResult.response}

Please provide a natural, helpful response to the user's question using this data. Be conversational and explain any technical information clearly. Keep the response concise but informative.`;

                console.log(
                  "Sending to Google GenAI:",
                  prompt.substring(0, 200) + "..."
                );

                const result = await model.generateContent(prompt);
                const aiResponse = result.response;
                const text = aiResponse.text();

                if (text && text.length > 10) {
                  response = text;
                  console.log(
                    "Google GenAI response received:",
                    response.substring(0, 100) + "..."
                  );
                } else {
                  throw new Error("No valid response from Google GenAI");
                }
              } catch (genAIError) {
                console.error("Direct Google GenAI error:", genAIError);

                // Fallback to Eliza processing
                console.log("Falling back to Eliza processing...");
                const enhancedMessage = `The user asked: "${message}"

I retrieved this blockchain data using MCP tools:
${mcpResult.response}

Please respond naturally to the user's question using this data. Be helpful, conversational, and explain any technical information clearly.`;

                try {
                  response = await processWithElizaRuntime(
                    enhancedMessage,
                    elizaRuntime,
                    mcpClient,
                    mcpContext
                  );

                  // If still getting fallback response, use friendly wrapper
                  if (
                    response.includes("I'm ready to help you") ||
                    response.includes("development tasks")
                  ) {
                    response = `\n\n${mcpResult.response}`;
                  }
                } catch (elizaError) {
                  console.error("Eliza processing error:", elizaError);
                  response = `Here's the information I retrieved:\n\n${mcpResult.response}`;
                }
              }

              console.log("AI-processed response:", response);
            } else {
              // Check if we should call an MCP tool
              console.log("About to call shouldCallMCPTool...");
              const toolCheck = await shouldCallMCPTool(message, mcpClient);
              console.log("shouldCallMCPTool result:", toolCheck);

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
  console.log("[ROUTE] GET function called!");
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
