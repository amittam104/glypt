import { Command } from "@oclif/core";

export default class Status extends Command {
	static description = "Show the current glypt development status.";

	async run(): Promise<void> {
		await this.parse(Status);
		this.log("glypt is under development.");
	}
}
