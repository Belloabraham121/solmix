# MCP + Eliza Integration

This Remix IDE clone now includes Model Context Protocol (MCP) integration with Eliza AI agent support.

## Features

### MCP Interface Tab
The right sidebar now includes two tabs:
1. **Compiler** - Original Solidity compiler interface
2. **MCP + Eliza** - New AI agent interface

### MCP + Eliza Capabilities

#### Connection Management
- Configure MCP server URL (default: `ws://localhost:3001`)
- Optional Eliza API key configuration
- Real-time connection status indicator
- Connect/disconnect functionality

#### AI Agent Interaction
- Chat interface with Eliza AI agent
- Message history with timestamps
- Support for user, assistant, and system messages
- Real-time typing indicators
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)

#### Smart Contract Development Support
Eliza can assist with:
- Code analysis and review
- Smart contract optimization suggestions
- Security best practices
- Deployment guidance
- Blockchain interaction patterns

## Usage

1. **Access the MCP Tab**: Click on the "MCP + Eliza" tab in the right sidebar
2. **Configure Connection**: Enter your MCP server URL and optional API key
3. **Connect**: Click "Connect to MCP" to establish connection
4. **Interact**: Start chatting with Eliza about your smart contract development needs

## Technical Implementation

### Components
- `MCPInterface` - Main MCP chat interface component
- Tab integration in main page layout
- Real-time message handling
- Connection state management

### Message Types
- **User**: Messages from the developer
- **Assistant**: Responses from Eliza AI
- **System**: Connection status and notifications

### Styling
- Consistent with existing IDE theme
- Dark mode support
- Responsive design
- Visual indicators for message types

## Future Enhancements

- Real WebSocket connection to MCP server
- Integration with actual Eliza AI API
- Code context sharing with AI agent
- Smart contract analysis integration
- Automated code suggestions
- Multi-agent support

## Configuration

The MCP interface supports the following configuration options:
- **MCP Server URL**: WebSocket endpoint for MCP server
- **Eliza API Key**: Authentication for Eliza AI services
- **Auto-connect**: Automatic connection on startup (future feature)

## Error Handling

- Connection timeout handling
- Graceful error messages
- Retry mechanisms
- Offline mode support