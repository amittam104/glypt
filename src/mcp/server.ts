import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { createIconAtlas } from "../core/atlas.js";
import { resolveIconRefs } from "../core/sessions.js";

const iconRoleSchema = z.object({
	id: z.string().trim().min(1),
	queries: z.array(z.string().trim().min(1)).min(1).max(6),
});

const showIconAtlasInputSchema = z.object({
	library: z.string().trim().min(1),
	roles: z.array(iconRoleSchema).min(1).max(8).optional(),
	cursor: z.string().trim().min(1).optional(),
	refresh: z.boolean().optional(),
});

const atlasRoleOutputSchema = z.object({
	id: z.string(),
	refs: z.array(z.string()),
});

const showIconAtlasOutputSchema = z.object({
	sessionId: z.string(),
	library: z.string(),
	prefix: z.string(),
	visibleRefs: z.array(z.string()),
	roles: z.array(atlasRoleOutputSchema).optional(),
	unresolvedRoleIds: z.array(z.string()),
	nextCursor: z.string().optional(),
});

const resolveIconInputSchema = z.object({
	sessionId: z.uuid(),
	refs: z.array(z.string().trim().min(1)).min(1).max(48),
});

const resolvedIconSchema = z.object({
	ref: z.string(),
	iconifyId: z.string(),
	prefix: z.string(),
	name: z.string(),
});

const resolveIconOutputSchema = z.object({
	sessionId: z.string(),
	icons: z.array(resolvedIconSchema),
});

function toolError(error: unknown) {
	const message =
		error instanceof Error ? error.message : "An unexpected error occurred";

	return {
		content: [{ type: "text" as const, text: message }],
		isError: true,
	};
}

export function createMcpServer(): McpServer {
	const server = new McpServer({
		name: "glypt",
		version: "0.1.0",
	});

	server.registerTool(
		"show_icon_atlas",
		{
			title: "Show icon atlas",
			description:
				"Render a visual PNG atlas from an icon library. Supply roles with visual queries for search, or omit roles to browse the collection.",
			inputSchema: showIconAtlasInputSchema,
			outputSchema: showIconAtlasOutputSchema,
		},
		async (input) => {
			try {
				const result = await createIconAtlas(input);
				const output = {
					sessionId: result.sessionId,
					library: result.library,
					prefix: result.prefix,
					visibleRefs: result.visibleRefs,
					unresolvedRoleIds: result.unresolvedRoleIds,
					...(result.roles ? { roles: result.roles } : {}),
					...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(output),
						},
						{
							type: "image",
							data: result.png.toString("base64"),
							mimeType: "image/png",
						},
					],
					structuredContent: output,
				};
			} catch (error) {
				return toolError(error);
			}
		},
	);

	server.registerTool(
		"resolve_icon",
		{
			title: "Resolve icon refs",
			description:
				"Resolve one or more opaque refs from a Glypt atlas session into Iconify IDs. This tool does not generate native package imports.",
			inputSchema: resolveIconInputSchema,
			outputSchema: resolveIconOutputSchema,
		},
		async ({ sessionId, refs }) => {
			try {
				const icons = await resolveIconRefs(sessionId, refs);
				const output = {
					sessionId,
					icons,
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(output),
						},
					],
					structuredContent: output,
				};
			} catch (error) {
				return toolError(error);
			}
		},
	);

	return server;
}
