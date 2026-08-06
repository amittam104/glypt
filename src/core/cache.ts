import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CacheEnvelope<T> = {
	schemaVersion: 1;
	sourceHost: string;
	fetchedAt: string;
	cacheTtlMs?: number;
	collectionRevision: string;
	data: T;
};

export function getCacheRoot(): string {
	const baseCacheDir = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");

	const glyptCache = join(baseCacheDir, "glypt-cache");

	return glyptCache;
}

export async function ensureCacheRoot(): Promise<void> {
	const cacheRoot = getCacheRoot();

	await mkdir(cacheRoot, { recursive: true });
}

export function getCollectionsCachePath(): string {
	return join(getCacheRoot(), "collections.json");
}

export function getCollectionCachePath(prefix: string): string {
	return join(getCacheRoot(), "collections", `${prefix}.json`);
}

export function getSearchCachePath(
	prefix: string,
	collectionRevision: string,
	queryHash: string,
): string {
	return join(
		getCacheRoot(),
		"search",
		`${prefix}`,
		`${collectionRevision}`,
		`${queryHash}.json`,
	);
}

export function getIconDataCachePath(
	prefix: string,
	collectionRevision: string,
	nameHash: string,
): string {
	return join(
		getCacheRoot(),
		"icon-data",
		`${prefix}`,
		`${collectionRevision}`,
		`${nameHash}.json`,
	);
}

export function getSessionCachePath(sessionId: string): string {
	return join(getCacheRoot(), "sessions", `${sessionId}.json`);
}

export function getSheetCachePath(sessionId: string, page: number): string {
	return join(getCacheRoot(), "sheets", `${sessionId}-${page}.png`);
}

export async function writeJsonFile(
	filePath: string,
	value: unknown,
): Promise<void> {
	try {
		await mkdir(dirname(filePath), { recursive: true });

		const jsonValue = JSON.stringify(value, null, 2);

		await writeFile(filePath, jsonValue, "utf-8");
	} catch (error) {
		throw new Error(`Failed to write JSON file: ${filePath}`, { cause: error });
	}
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
	try {
		const value = await readFile(filePath, "utf-8");

		return JSON.parse(value) as T;
	} catch (error) {
		if (
			error instanceof Error &&
			(error as NodeJS.ErrnoException).code === "ENOENT"
		)
			return null;

		throw new Error(`Failed to read JSON file: ${filePath}`, {
			cause: error,
		});
	}
}

export function createCacheEnvelope<T>(
	data: T,
	sourceHost: string,
	collectionRevision: string,
	cacheTtlMs?: number,
): CacheEnvelope<T> {
	return {
		schemaVersion: 1,
		sourceHost,
		fetchedAt: new Date().toISOString(),
		cacheTtlMs: cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
		collectionRevision,
		data,
	};
}

export function isCacheFresh(
	fetchedAt: string,
	cacheTtlMs = DEFAULT_CACHE_TTL_MS,
): boolean {
	const fetchedTime = Date.parse(fetchedAt);

	if (Number.isNaN(fetchedTime)) return false;

	const age = Date.now() - fetchedTime;

	return age >= 0 && age <= cacheTtlMs;
}
