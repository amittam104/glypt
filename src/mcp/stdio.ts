import {
	type StdioServerHandle,
	serveStdio,
} from "@modelcontextprotocol/server/stdio";
import { createMcpServer } from "./server.js";

export function startMcpServer(): StdioServerHandle {
	console.error("glypt MCP server running on stdio");

	return serveStdio(createMcpServer, {
		onerror: (error) => {
			console.error(`[glypt:mcp] ${error.message}`);
		},
	});
}
