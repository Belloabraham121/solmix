import { NextResponse } from "next/server";
import MCPClientSingleton from "@/lib/mcp-singleton";

/**
 * Debug endpoint to inspect MCP client internal state
 */
export async function GET() {
  try {
    console.log("=== MCP DEBUG START ===");

    const client = await MCPClientSingleton.getInstance();
    console.log("Debug: Got client instance:", client.instanceId);

    // Access private connections map via reflection
    const connections = (client as any).connections;
    console.log("Debug: Connections map size:", connections.size);

    const connectionDetails = [];
    for (const [name, connection] of connections.entries()) {
      const details = {
        name,
        connected: connection.connected,
        toolCount: connection.tools?.length || 0,
        processKilled: connection.process?.killed,
        processExitCode: connection.process?.exitCode,
        messageId: connection.messageId,
        tools: connection.tools?.map((t: any) => t.name) || [],
      };
      connectionDetails.push(details);
      console.log(`Debug: Connection ${name}:`, details);
    }

    const status = client.getStatus();
    console.log("Debug: Client status:", status);

    const connectedServers = client.getConnectedServers();
    console.log("Debug: Connected servers:", connectedServers);

    const allTools = await client.getAllTools();
    console.log("Debug: All tools count:", allTools.length);

    console.log("=== MCP DEBUG END ===");

    return NextResponse.json({
      success: true,
      data: {
        instanceId: client.instanceId,
        connectionsMapSize: connections.size,
        connectionDetails,
        status,
        connectedServers,
        allToolsCount: allTools.length,
        allTools: allTools.map((t: any) => ({
          name: t.name,
          serverName: t.serverName,
        })),
      },
    });
  } catch (error) {
    console.error("=== MCP DEBUG ERROR ===", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
