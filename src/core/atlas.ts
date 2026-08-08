import type { IconifyJSON } from "@iconify/types";
import { getIconData } from "@iconify/utils";
import { getSheetCachePath, writeBinaryFile } from "./cache.js";
import { resolveIconCollection } from "./context.js";
import {
	type CollectionResponse,
	getCachedCollectionEnvelope,
	getCachedIconData,
	getCachedSearch,
} from "./iconify-client.js";
import { type AtlasRow, renderAtlasPng } from "./renderer.js";
import { createIconSession } from "./sessions.js";

const ATLAS_ICON_LIMIT = 48;
const CELLS_PER_ROW = 6;
const MAX_QUERIES_PER_ROLE = 6;
const MAX_ROLES = 8;

export type IconRole = {
	id: string;
	queries: string[];
};

export type IconAtlasInput = {
	library: string;
	roles?: IconRole[];
	cursor?: string;
	refresh?: boolean;
};

export type IconAtlasResult = {
	sessionId: string;
	library: string;
	prefix: string;
	png: Buffer;
	imagePath: string;
	visibleRefs: string[];
	roles?: { id: string; refs: string[] }[];
	unresolvedRoleIds: string[];
	nextCursor?: string;
};

type CandidateRow = {
	roleId?: string;
	label: string;
	names: string[];
};

type RoleCandidates = {
	id: string;
	names: string[];
};

type CandidateRows = {
	rows: CandidateRow[];
	roleIds?: string[];
	page: number;
	nextCursor?: string;
};

function normalizeRoles(roles: IconRole[]): IconRole[] {
	if (roles.length === 0 || roles.length > MAX_ROLES) {
		throw new Error(`Provide between 1 and ${MAX_ROLES} icon roles`);
	}

	const ids = new Set<string>();

	return roles.map((role) => {
		const id = role.id.trim();

		if (!id) {
			throw new Error("Every icon role needs a non-empty id");
		}

		if (
			!Array.isArray(role.queries) ||
			role.queries.length === 0 ||
			role.queries.length > MAX_QUERIES_PER_ROLE
		) {
			throw new Error(
				`Every icon role needs between 1 and ${MAX_QUERIES_PER_ROLE} queries`,
			);
		}

		const queries = role.queries.map((query) =>
			query.trim().replace(/\s+/g, " "),
		);

		if (queries.some((query) => !query)) {
			throw new Error("Icon role queries cannot be empty");
		}

		if (ids.has(id)) {
			throw new Error(`Duplicate icon role id: ${id}`);
		}

		ids.add(id);

		return {
			id,
			queries: [
				...new Map(
					queries.map((query) => [query.toLowerCase(), query]),
				).values(),
			],
		};
	});
}

function roundRobinUnique(
	groups: string[][],
): { group: number; name: string }[] {
	const results: { group: number; name: string }[] = [];
	const seen = new Set<string>();
	const longestGroup = Math.max(0, ...groups.map((group) => group.length));

	for (let index = 0; index < longestGroup; index += 1) {
		for (const [group, names] of groups.entries()) {
			const name = names[index];

			if (name && !seen.has(name)) {
				seen.add(name);
				results.push({ group, name });
			}

			if (results.length === ATLAS_ICON_LIMIT) {
				return results;
			}
		}
	}

	return results;
}

function parseCursor(cursor: string | undefined): number {
	if (cursor === undefined) {
		return 0;
	}

	const page = Number(cursor);

	if (!Number.isSafeInteger(page) || page < 0) {
		throw new Error(`Invalid atlas cursor: ${cursor}`);
	}

	return page;
}

function getCollectionIconNames(collection: CollectionResponse): string[] {
	const hidden = new Set(collection.hidden ?? []);
	const names = [
		...Object.values(collection.categories ?? {}).flat(),
		...(collection.uncategorized ?? []),
	];

	return [...new Set(names)].filter((name) => name && !hidden.has(name)).sort();
}

function getSearchIconName(prefix: string, iconifyId: string): string | null {
	const marker = `${prefix}:`;

	if (!iconifyId.startsWith(marker)) {
		return null;
	}

	return iconifyId.slice(marker.length) || null;
}

async function getCandidateRows(
	roles: IconRole[] | undefined,
	cursor: string | undefined,
	prefix: string,
	collection: CollectionResponse,
	collectionRevision: string,
	refresh: boolean,
): Promise<CandidateRows> {
	if (roles !== undefined) {
		if (cursor !== undefined) {
			throw new Error("Atlas cursors are only used when browsing a collection");
		}

		const normalizedRoles = normalizeRoles(roles);
		const hidden = new Set(collection.hidden ?? []);
		const searches = new Map<string, Promise<string[]>>();
		const roleCandidates = await Promise.all(
			normalizedRoles.map(async (role) => {
				const queryResults = await Promise.all(
					role.queries.map((query) => {
						const key = query.toLowerCase();
						let search = searches.get(key);

						if (!search) {
							search = getCachedSearch(query, ATLAS_ICON_LIMIT, 0, prefix, {
								collectionRevision,
								refresh,
							}).then((result) =>
								result.icons
									.map((iconifyId) => getSearchIconName(prefix, iconifyId))
									.filter(
										(name): name is string =>
											name !== null && !hidden.has(name),
									),
							);
							searches.set(key, search);
						}

						return search;
					}),
				);

				return {
					id: role.id,
					names: roundRobinUnique(queryResults).map(({ name }) => name),
				};
			}),
		);
		const selectedRoles: RoleCandidates[] = normalizedRoles.map(({ id }) => ({
			id,
			names: [],
		}));

		for (const { group, name } of roundRobinUnique(
			roleCandidates.map(({ names }) => names),
		)) {
			selectedRoles[group].names.push(name);
		}

		const rows = selectedRoles.flatMap((role) => {
			const roleRows: CandidateRow[] = [];

			for (let index = 0; index < role.names.length; index += CELLS_PER_ROW) {
				roleRows.push({
					roleId: role.id,
					label: index === 0 ? role.id : "",
					names: role.names.slice(index, index + CELLS_PER_ROW),
				});
			}

			return roleRows;
		});

		return { rows, page: 0, roleIds: normalizedRoles.map(({ id }) => id) };
	}

	const page = parseCursor(cursor);
	const allNames = getCollectionIconNames(collection);
	const start = page * ATLAS_ICON_LIMIT;
	const pageNames = allNames.slice(start, start + ATLAS_ICON_LIMIT);

	if (pageNames.length === 0) {
		throw new Error(`No icons found for atlas cursor: ${page}`);
	}

	const rows: CandidateRow[] = [];

	for (let index = 0; index < pageNames.length; index += CELLS_PER_ROW) {
		const rowIndex = rows.length;
		rows.push({
			label: String.fromCharCode(65 + rowIndex),
			names: pageNames.slice(index, index + CELLS_PER_ROW),
		});
	}

	return {
		rows,
		page,
		nextCursor:
			start + pageNames.length < allNames.length ? String(page + 1) : undefined,
	};
}

function assignRenderableRefs(
	rows: CandidateRow[],
	iconSet: IconifyJSON,
): AtlasRow[] {
	return rows.map((row, rowIndex) => ({
		label: row.label,
		cells: row.names
			.filter((name) => getIconData(iconSet, name))
			.map((name, columnIndex) => ({
				name,
				ref: `${String.fromCharCode(65 + rowIndex)}${columnIndex + 1}`,
			})),
	}));
}

export async function createIconAtlas(
	input: IconAtlasInput,
): Promise<IconAtlasResult> {
	const collection = await resolveIconCollection(input.library, input.refresh);
	const collectionEnvelope = await getCachedCollectionEnvelope(
		collection.prefix,
		input.refresh,
	);
	const candidates = await getCandidateRows(
		input.roles,
		input.cursor,
		collection.prefix,
		collectionEnvelope.data,
		collectionEnvelope.collectionRevision,
		input.refresh ?? false,
	);
	const candidateNames = [
		...new Set(candidates.rows.flatMap((row) => row.names)),
	];
	const iconSet: IconifyJSON = candidateNames.length
		? await getCachedIconData(
				collection.prefix,
				candidateNames,
				collectionEnvelope.collectionRevision,
				input.refresh,
			)
		: { prefix: collection.prefix, icons: {} };
	const rows = assignRenderableRefs(candidates.rows, iconSet);
	const visibleCells = rows.flatMap((row) => row.cells);

	if (input.roles === undefined && visibleCells.length === 0) {
		throw new Error("Iconify returned no renderable icons for this atlas page");
	}

	const refs = Object.fromEntries(
		visibleCells.map((cell) => [cell.ref, `${collection.prefix}:${cell.name}`]),
	);
	const session = await createIconSession(
		collection.name,
		collection.prefix,
		refs,
	);
	const mode =
		input.roles === undefined ? `browse ${candidates.page + 1}` : "roles";
	const png = renderAtlasPng(iconSet, rows, `${collection.name} · ${mode}`);
	const imagePath = getSheetCachePath(session.sessionId, candidates.page);

	await writeBinaryFile(imagePath, png);

	const roleResults = (candidates.roleIds ?? []).map((id) => ({
		id,
		refs: candidates.rows.flatMap((row, index) =>
			row.roleId === id ? rows[index].cells.map((cell) => cell.ref) : [],
		),
	}));

	return {
		sessionId: session.sessionId,
		library: collection.name,
		prefix: collection.prefix,
		png,
		imagePath,
		visibleRefs: visibleCells.map((cell) => cell.ref),
		roles: input.roles === undefined ? undefined : roleResults,
		unresolvedRoleIds: roleResults
			.filter((role) => role.refs.length === 0)
			.map((role) => role.id),
		nextCursor: candidates.nextCursor,
	};
}
