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
          
          // Simulate Eliza agent initialization
          elizaAgent = {
            id: 'eliza-' + Date.now(),
            name: 'Eliza AI Agent',
            capabilities: ['smart-contract-analysis', 'code-review', 'deployment-guidance'],
            mcpIntegration: true,
            connectedServers: mcpClient.getConnectedServers(),
            availableTools: mcpClient.getAllTools()
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
          
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
          
          // Check if the message requests tool usage
          const lowerMessage = message.toLowerCase();
          let response = '';
          
          if (lowerMessage.includes('list tools') || lowerMessage.includes('available tools')) {
            const tools = mcpClient.getAllTools();
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
          } else if (lowerMessage.includes('call tool') || lowerMessage.includes('use tool')) {
            // Extract tool name and arguments (simplified parsing)
            const tools = mcpClient.getAllTools();
            if (tools.length > 0) {
              response = `I can call these tools for you: ${tools.map(t => t.name).join(', ')}. Please specify which tool you'd like me to use and with what parameters.`;
            } else {
              response = "No tools are currently available. Please check the MCP server connections.";
            }
          } else {
            // Generate contextual response based on message content
            response = getRandomElizaResponse(message);
            
            // Add MCP context if relevant
            if (mcpClient.getConnectedServers().length > 0) {
              response += `\n\n*I'm connected to ${mcpClient.getConnectedServers().length} MCP server(s) and have access to ${mcpClient.getAllTools().length} tools to assist you.*`;
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