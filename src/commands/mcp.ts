import { Command } from "@oclif/core";
import { startMcpServer } from "../mcp/stdio.js";

export default class Mcp extends Command {
	static description = "Start the glypt MCP server over stdio.";

	async run(): Promise<void> {
		await this.parse(Mcp);
		startMcpServer();
	}
}
