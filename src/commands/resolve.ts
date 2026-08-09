import { Args, Command } from "@oclif/core";
import { resolveIconRefs } from "../core/sessions.js";

export default class Resolve extends Command {
	static description = "Resolve icon atlas refs into Iconify IDs.";
	static examples = [
		"<%= config.bin %> <%= command.id %> 123e4567-e89b-42d3-a456-426614174000 A1 B2",
	];

	static args = {
		session: Args.string({
			description: "Icon atlas session ID",
			required: true,
		}),
		refs: Args.string({
			description: "One or more refs from the atlas",
			multiple: true,
			required: true,
		}),
	};

	async run(): Promise<void> {
		const { args } = await this.parse(Resolve);
		const icons = await resolveIconRefs(args.session, args.refs);

		this.log(
			JSON.stringify(
				{
					sessionId: args.session,
					icons,
				},
				null,
				2,
			),
		);
	}
}
