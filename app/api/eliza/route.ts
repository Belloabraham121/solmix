import { NextRequest, NextResponse } from 'next/server';
import { MCPClient } from '@/lib/mcp-client';
import MCPClientSingleton from '@/lib/mcp-singleton';

// Global MCP client instance
let mcpClient: MCPClient | null = null;
let elizaAgent: any = null;

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

// Simulated Eliza responses for demonstration
const elizaResponses = [
  "I can help you with smart contract development. What would you like to work on?",
  "Let me analyze your code and provide suggestions for optimization.",
  "I notice you're working with Solidity. Would you like me to review your contract for security issues?",
  "Based on your code, I recommend implementing proper access controls and input validation.",
  "I can help you deploy this contract to the Sei blockchain. Would you like me to guide you through the process?",
  "Your contract looks good! Consider adding events for better transparency and debugging.",
  "I suggest using OpenZeppelin's libraries for standard implementations like ERC20 or ERC721.",
  "For gas optimization, consider using 'uint256' instead of smaller integer types in most cases.",
  "Remember to implement proper error handling with custom errors for better gas efficiency.",
  "Would you like me to help you write comprehensive tests for your smart contract?"
];

function getRandomElizaResponse(userMessage: string): string {
  // Simple keyword-based response selection
  const message = userMessage.toLowerCase();
  
  if (message.includes('deploy') || message.includes('deployment')) {
    return "I can help you deploy this contract to the Sei blockchain. Would you like me to guide you through the process?";
  }
  
  if (message.includes('security') || message.includes('audit')) {
    return "Based on your code, I recommend implementing proper access controls and input validation. I can also check for common security vulnerabilities.";
  }
  
  if (message.includes('gas') || message.includes('optimize')) {
    return "For gas optimization, consider using 'uint256' instead of smaller integer types, and implement custom errors instead of require statements with strings.";
  }
  
  if (message.includes('test') || message.includes('testing')) {
    return "Would you like me to help you write comprehensive tests for your smart contract? I can suggest test cases for edge conditions and security scenarios.";
  }
  
  if (message.includes('erc20') || message.includes('token')) {
    return "I suggest using OpenZeppelin's ERC20 implementation as a base. It's well-tested and follows best practices for token contracts.";
  }
  
  // Return a random response for general queries
  return elizaResponses[Math.floor(Math.random() * elizaResponses.length)];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, message, config } = body;

    switch (action) {
      case 'connect':
        try {
          // Use the singleton MCP client instead of creating a new one
          console.log('Eliza: Getting MCP client from singleton...');
          mcpClient = await MCPClientSingleton.getInstance();
          console.log('Eliza: Got MCP client instance:', mcpClient.instanceId);
          
          // Set up event listeners
          mcpClient.on('status', (status) => {
            console.log('MCP Status:', status);
          });
          
          mcpClient.on('error', (error) => {
            console.error('MCP Error:', error);
          });
          
          mcpClient.on('server_connected', (event) => {
            console.log('MCP Server Connected:', event);
          });
          
          // Client is already initialized by singleton
          
          // Get available tools from MCP client
          const availableTools = mcpClient.getAllTools();
          console.log('Available tools:', availableTools);
          
          // Simulate Eliza agent initialization
          elizaAgent = {
            id: 'eliza-' + Date.now(),
            name: 'Eliza AI Agent',
            capabilities: ['smart-contract-analysis', 'code-review', 'deployment-guidance'],
            mcpIntegration: true,
            connectedServers: mcpClient.getConnectedServers(),
            availableTools: availableTools
          };
          
          return NextResponse.json({
            success: true,
            message: 'Successfully connected to Eliza agent with MCP integration',
            agent: elizaAgent,
            mcpStatus: mcpClient.getStatus()
          });
        } catch (error) {
          console.error('Connection error:', error);
          return NextResponse.json({
            success: false,
            error: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case 'disconnect':
        try {
          if (mcpClient) {
            await mcpClient.disconnect();
            mcpClient = null;
          }
          elizaAgent = null;
          
          return NextResponse.json({
            success: true,
            message: 'Successfully disconnected from Eliza agent and MCP servers'
          });
        } catch (error) {
          console.error('Disconnection error:', error);
          return NextResponse.json({
            success: false,
            error: `Failed to disconnect: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case 'send':
        try {
          if (!elizaAgent || !mcpClient) {
            return NextResponse.json({
              success: false,
              error: 'Eliza agent is not connected. Please connect first.'
            }, { status: 400 });
          }
          
          if (!message) {
            return NextResponse.json({
              success: false,
              error: 'Message is required'
            }, { status: 400 });
          }
          
          // Extract MCP context from request
          const { mcpContext } = body;
          
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
          
          let response = '';
          const lowerMessage = message.toLowerCase();
          
          // Handle MCP context-aware queries
          if (mcpContext && mcpContext.serverId) {
            console.log('Processing message with MCP context:', mcpContext);
            
            try {
              // Handle Sei blockchain queries
              if (mcpContext.serverId === 'sei-mcp-server') {
                if (lowerMessage.includes('balance') && lowerMessage.includes('0x')) {
                  // Extract address from message
                  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
                  if (addressMatch) {
                    const address = addressMatch[0];
                    
                    // Try to call the balance tool
                     const tools = mcpContext.availableTools || [];
                     const balanceTool = tools.find((tool: any) => 
                       tool.name.toLowerCase().includes('balance') || 
                       tool.name.toLowerCase().includes('account')
                     );
                     
                     if (balanceTool) {
                       try {
                         const result = await mcpClient.callTool({
                           toolName: balanceTool.name,
                           serverName: mcpContext.serverId,
                           arguments: { address: address }
                         });
                         response = `Here's the balance information for address ${address}:\n\n${JSON.stringify(result, null, 2)}`;
                       } catch (toolError) {
                         console.error('Tool call error:', toolError);
                         response = `I tried to check the balance for ${address}, but encountered an error: ${toolError instanceof Error ? toolError.message : String(toolError)}. The sei-mcp-server might need proper configuration or the address format might be incorrect.`;
                       }
                     } else {
                       response = `I can help you check the Sei balance for ${address}, but I don't see a balance checking tool available in the sei-mcp-server. Available tools: ${tools.map((t: { name: string }) => t.name).join(', ')}`;
                     }
                  } else {
                    response = "I can help you check Sei balances, but I need a valid address (starting with 0x). Please provide a valid Sei address.";
                  }
                } else {
                  response = `I'm connected to the Sei MCP server and can help with blockchain operations. Available tools: ${mcpContext.availableTools?.map(t => t.name).join(', ') || 'None'}. What would you like me to help you with?`;
                }
              }
              // Handle filesystem queries
               else if (mcpContext.serverId === 'filesystem-server') {
                 response = `I'm connected to the filesystem server and can help with file operations. Available tools: ${mcpContext.availableTools?.map((t: any) => t.name).join(', ') || 'None'}. What file operation would you like me to perform?`;
               }
               // Handle memory queries
               else if (mcpContext.serverId === 'memory-server') {
                 response = `I'm connected to the memory server and can help with data storage and retrieval. Available tools: ${mcpContext.availableTools?.map((t: any) => t.name).join(', ') || 'None'}. What would you like me to remember or recall?`;
               }
               else {
                 response = `I'm connected to ${mcpContext.serverName} with ${mcpContext.availableTools?.length || 0} available tools. How can I help you?`;
               }
            } catch (error) {
              console.error('MCP context processing error:', error);
              response = `I encountered an error while processing your request with ${mcpContext.serverName}: ${error instanceof Error ? error.message : String(error)}`;
            }
          }
          // Handle general queries without specific MCP context
          else if (lowerMessage.includes('list tools') || lowerMessage.includes('available tools')) {
            const tools = await mcpClient.getAllTools();
            if (tools.length > 0) {
              response = `I have access to ${tools.length} tools across ${mcpClient.getConnectedServers().length} MCP servers:\n\n`;
              tools.forEach(tool => {
                response += `• **${tool.name}** (${tool.serverName}): ${tool.description || 'No description available'}\n`;
              });
            } else {
              response = "I don't have any tools available at the moment. Please check the MCP server connections.";
            }
          } else if (lowerMessage.includes('server status') || lowerMessage.includes('mcp status')) {
            const status = mcpClient.getStatus();
            response = `MCP Status:\n• Connected servers: ${status.connectedServers}\n• Total tools: ${status.totalTools}\n• Servers: ${status.servers.map(s => `${s.name} (${s.connected ? 'connected' : 'disconnected'})`).join(', ')}`;
          } else {
            // Generate contextual response based on message content
            response = getRandomElizaResponse(message);
            
            // Add MCP context if relevant
            if (mcpClient.getConnectedServers().length > 0) {
              const tools = await mcpClient.getAllTools();
              response += `\n\n*I'm connected to ${mcpClient.getConnectedServers().length} MCP server(s) and have access to ${tools.length} tools to assist you.*`;
            }
          }
          
          return NextResponse.json({
            success: true,
            message: response,
            agent: elizaAgent,
            mcpStatus: mcpClient.getStatus()
          });
        } catch (error) {
          console.error('Message processing error:', error);
          return NextResponse.json({
            success: false,
            error: `Failed to process message: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case 'status':
        return NextResponse.json({
          success: true,
          connected: !!elizaAgent,
          agent: elizaAgent,
          mcpStatus: mcpClient?.getStatus() || null
        });

      case 'call_tool':
        try {
          if (!mcpClient) {
            return NextResponse.json({
              success: false,
              error: 'MCP client is not connected'
            }, { status: 400 });
          }
          
          const { toolName, serverName, arguments: toolArgs } = body;
          
          if (!toolName || !serverName) {
            return NextResponse.json({
              success: false,
              error: 'toolName and serverName are required'
            }, { status: 400 });
          }
          
          const result = await mcpClient.callTool({
            toolName,
            serverName,
            arguments: toolArgs || {}
          });
          
          return NextResponse.json({
            success: true,
            result,
            mcpStatus: mcpClient.getStatus()
          });
        } catch (error) {
          console.error('Tool call error:', error);
          return NextResponse.json({
            success: false,
            error: `Tool call failed: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
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
      call_tool: 'POST /api/eliza with action: "call_tool", toolName, serverName, arguments'
    }
  });
}