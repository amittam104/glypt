import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createMcpServer } from "./server.js";

void serveStdio(createMcpServer, {
	onerror: (error) => {
		console.error(`[glypt:mcp] ${error.message}`);
	},
});

console.error("glypt MCP server running on stdio");
