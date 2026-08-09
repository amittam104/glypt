import { Command, Flags } from "@oclif/core";
import { createIconAtlas, type IconRole } from "../core/atlas.js";

function parseRoles(values: string[] | undefined): IconRole[] | undefined {
	if (!values) {
		return undefined;
	}

	const roles = new Map<string, string[]>();

	for (const value of values) {
		const separator = value.indexOf("=");
		const id = value.slice(0, separator).trim();
		const query = value.slice(separator + 1).trim();

		if (separator < 1 || !id || !query) {
			throw new Error(`--role must use id=query syntax: ${value}`);
		}

		const queries = roles.get(id) ?? [];
		queries.push(query);
		roles.set(id, queries);
	}

	return [...roles].map(([id, queries]) => ({ id, queries }));
}

export default class Atlas extends Command {
	static description = "Render an icon atlas from an Iconify library.";

	static examples = [
		"<%= config.bin %> <%= command.id %> --library lucide-react --role navigation=arrow --role navigation=chevron",
		"<%= config.bin %> <%= command.id %> --library lucide-react --cursor 1",
	];

	static flags = {
		library: Flags.string({
			description: "Icon library or npm package name",
			required: true,
		}),
		role: Flags.string({
			description: "Visual query as id=query; repeat for more roles or queries",
			multiple: true,
		}),
		cursor: Flags.string({
			description: "Cursor returned by a previous collection page",
		}),
		refresh: Flags.boolean({
			description: "Refresh cached Iconify data",
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Atlas);
		const result = await createIconAtlas({
			library: flags.library,
			roles: parseRoles(flags.role),
			cursor: flags.cursor,
			refresh: flags.refresh,
		});
		const output = {
			sessionId: result.sessionId,
			library: result.library,
			prefix: result.prefix,
			imagePath: result.imagePath,
			visibleRefs: result.visibleRefs,
			unresolvedRoleIds: result.unresolvedRoleIds,
			...(result.roles ? { roles: result.roles } : {}),
			...(result.nextCursor !== undefined
				? { nextCursor: result.nextCursor }
				: {}),
		};

		this.log(JSON.stringify(output, null, 2));
	}
}
