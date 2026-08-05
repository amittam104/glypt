import { createHash } from "node:crypto";
import type { IconifyJSON } from "@iconify/types";
import {
	type CacheEnvelope,
	createCacheEnvelope,
	getCollectionCachePath,
	getIconDataCachePath,
	getSearchCachePath,
	isCacheFresh,
	readJsonFile,
	writeJsonFile,
} from "./cache.js";

const DEFAULT_API_HOSTS = [
	"https://api.iconify.design",
	"https://api.simplesvg.com",
	"https://api.unisvg.com",
];

export type CollectionResponse = {
	prefix: string;
	total: number;
	title?: string;
	categories?: Record<string, string[]>;
	uncategorized?: string[];
	hidden?: string[];
	aliases?: Record<string, string>;
};

export type LastModifiedResponse = {
	lastModified: Record<string, number>;
};

export type JsonResponse<T> = {
	data: T;
	sourceHost: string;
};

export type SearchResponse = {
	icons: string[];
	total: number;
	limit: number;
	start: number;
	collections?: Record<string, unknown>;
	request?: Record<string, string>;
};

export async function requestJson<T>(path: string): Promise<JsonResponse<T>> {
	let lastError: unknown;

	for (const host of getAPIHosts()) {
		const signal = AbortSignal.timeout(5000);
		let response: Response;

		try {
			response = await fetch(buildApiUrl(host, path), {
				signal,
				headers: {
					"User-Agent": "glypt/0.1.0",
				},
			});
		} catch (error) {
			lastError = error;
			continue;
		}

		if (response.ok) {
			return {
				data: (await response.json()) as T,
				sourceHost: host,
			};
		}

		const statusError = new Error(
			`Iconify request failed with status ${response.status}`,
		);

		if (!isRetryableStatus(response.status)) {
			throw statusError;
		}

		lastError = statusError;
	}

	throw new Error(`All Iconify API hosts failed for ${path}`, {
		cause: lastError,
	});
}

export async function getCollectionVersion(prefix: string): Promise<string> {
	const res = await requestJson<LastModifiedResponse>(
		`last-modified?prefix=${encodeURIComponent(prefix)}`,
	);

	const revision = res.data.lastModified[prefix];

	if (revision === undefined) {
		throw new Error(`No revision found for ${prefix}`);
	}

	return String(revision);
}

export async function fetchCollection(
	prefix: string,
): Promise<JsonResponse<CollectionResponse>> {
	return requestJson<CollectionResponse>(
		`collection?prefix=${encodeURIComponent(prefix)}&info=1`,
	);
}

export async function getCachedCollection(
	prefix: string,
): Promise<CollectionResponse> {
	const cachePath = getCollectionCachePath(prefix);

	const cached =
		await readJsonFile<CacheEnvelope<CollectionResponse>>(cachePath);

	if (cached && isCacheFresh(cached.fetchedAt)) {
		return cached.data;
	}

	const currentVersion = await getCollectionVersion(prefix);

	if (cached && currentVersion === cached?.collectionRevision) {
		const refreshedEnvelop = createCacheEnvelope(
			cached?.data,
			cached.sourceHost,
			currentVersion,
		);

		await writeJsonFile(cachePath, refreshedEnvelop);

		return cached.data;
	}

	const freshCollection = await fetchCollection(prefix);

	const freshEnvelop = createCacheEnvelope(
		freshCollection.data,
		freshCollection.sourceHost,
		currentVersion,
	);

	await writeJsonFile(cachePath, freshEnvelop);

	return freshCollection.data;
}

export function isRetryableStatus(status: number): boolean {
	if (status >= 500 && status <= 599) {
		return true;
	} else if (status === 429) {
		return true;
	}
	return false;
}

export function getAPIHosts(): string[] {
	const configuredHost = process.env.GLYPT_API_URL;

	if (!configuredHost) {
		return DEFAULT_API_HOSTS;
	}

	let parsedUrl: URL;

	try {
		parsedUrl = new URL(configuredHost);
	} catch {
		throw new Error(`Invalid GLYPT_API_URL: ${configuredHost}`);
	}

	const isLocalhost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
		parsedUrl.hostname,
	);

	const isHttps = parsedUrl.protocol === "https:";
	const isAllowedLocalHttp = parsedUrl.protocol === "http:" && isLocalhost;

	if (!isHttps && !isAllowedLocalHttp) {
		throw new Error(
			"GLYPT_API_URL must use HTTPS, except for localhost development.",
		);
	}

	const normalizedHost = parsedUrl.toString().replace(/\/+$/, "");

	return [normalizedHost];
}

export function buildApiUrl(host: string, path: string): string {
	const normalizedHost = host.replace(/\/+$/, "");

	return `${normalizedHost}/${path.replace(/^\/+/, "")}`;
}

export async function fetchSearch(
	path: string,
): Promise<JsonResponse<SearchResponse>> {
	return requestJson<SearchResponse>(path);
}

export async function fetchIconData(
	prefix: string,
	names: string[],
): Promise<JsonResponse<IconifyJSON>> {
	const uniqueNames = [...new Set(names)].sort();

	if (uniqueNames.length === 0) {
		throw new Error("At least one icon name is required");
	}

	const searchParams = new URLSearchParams({
		icons: uniqueNames.join(","),
	});

	return requestJson<IconifyJSON>(`/${prefix}.json?${searchParams.toString()}`);
}

export function splitIconNamesIntoBatches(
	prefix: string,
	names: string[],
	maxUrlLength = 500,
): string[][] {
	const uniqueNames = [...new Set(names)].sort();
	const batches: string[][] = [];
	let currentBatch: string[] = [];

	for (const name of uniqueNames) {
		const candidateBatch = [...currentBatch, name];
		const searchParams = new URLSearchParams({
			icons: candidateBatch.join(","),
		});
		const path = `/${prefix}.json?${searchParams.toString()}`;

		if (path.length <= maxUrlLength) {
			currentBatch = candidateBatch;
			continue;
		}

		if (currentBatch.length === 0) {
			throw new Error(`Icon name is too long for the API request: ${name}`);
		}

		batches.push(currentBatch);
		currentBatch = [name];

		const singleIconParams = new URLSearchParams({ icons: name });
		const singleIconPath = `/${prefix}.json?${singleIconParams.toString()}`;

		if (singleIconPath.length > maxUrlLength) {
			throw new Error(`Icon name is too long for the API request: ${name}`);
		}
	}

	if (currentBatch.length > 0) {
		batches.push(currentBatch);
	}

	return batches;
}

function mergeIconifyData(dataSets: IconifyJSON[]): IconifyJSON {
	const [firstDataSet, ...remainingDataSets] = dataSets;

	if (!firstDataSet) {
		throw new Error("At least one Iconify response is required");
	}

	const mergedData: IconifyJSON = {
		...firstDataSet,
		icons: { ...firstDataSet.icons },
	};

	for (const dataSet of remainingDataSets) {
		Object.assign(mergedData.icons, dataSet.icons);

		if (dataSet.aliases) {
			mergedData.aliases = {
				...mergedData.aliases,
				...dataSet.aliases,
			};
		}

		if (dataSet.not_found) {
			mergedData.not_found = [
				...new Set([...(mergedData.not_found ?? []), ...dataSet.not_found]),
			];
		}
	}

	return mergedData;
}

async function getCachedIconDataBatch(
	prefix: string,
	names: string[],
	collectionRevision: string,
): Promise<IconifyJSON> {
	const namesHash = createHash("sha256")
		.update(JSON.stringify(names))
		.digest("hex");

	const cachePath = getIconDataCachePath(prefix, collectionRevision, namesHash);
	const cached = await readJsonFile<CacheEnvelope<IconifyJSON>>(cachePath);

	if (
		cached &&
		cached.collectionRevision === collectionRevision &&
		isCacheFresh(cached.fetchedAt)
	) {
		return cached.data;
	}

	const freshIconData = await fetchIconData(prefix, names);
	const envelope = createCacheEnvelope(
		freshIconData.data,
		freshIconData.sourceHost,
		collectionRevision,
	);

	await writeJsonFile(cachePath, envelope);

	return envelope.data;
}

export async function getCachedIconData(
	prefix: string,
	names: string[],
	collectionRevision: string,
): Promise<IconifyJSON> {
	const uniqueNames = [...new Set(names)].sort();

	if (uniqueNames.length === 0) {
		throw new Error("At least one icon name is required");
	}

	const batches = splitIconNamesIntoBatches(prefix, uniqueNames);
	const iconData: IconifyJSON[] = [];
	const maxConcurrentBatches = 4;

	for (
		let batchStart = 0;
		batchStart < batches.length;
		batchStart += maxConcurrentBatches
	) {
		const batchGroup = batches.slice(
			batchStart,
			batchStart + maxConcurrentBatches,
		);

		const groupData = await Promise.all(
			batchGroup.map((batch) =>
				getCachedIconDataBatch(prefix, batch, collectionRevision),
			),
		);

		iconData.push(...groupData);
	}

	return mergeIconifyData(iconData);
}

export async function getCachedCollectionEnvelope(
	prefix: string,
): Promise<CacheEnvelope<CollectionResponse>> {
	await getCachedCollection(prefix);

	const path = getCollectionCachePath(prefix);

	const envelope = await readJsonFile<CacheEnvelope<CollectionResponse>>(path);

	if (!envelope) {
		throw new Error(`No cached collection found for prefix: ${prefix}`);
	}

	return envelope;
}

export async function getCachedSearch(
	query: string,
	limit: number,
	start: number,
	prefix: string,
): Promise<SearchResponse> {
	const cachedCollectionEnvelope = await getCachedCollectionEnvelope(prefix);
	const collectionRevision = cachedCollectionEnvelope.collectionRevision;

	const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, " ");

	const searchKey = JSON.stringify({
		prefix,
		query: normalizedQuery,
		limit,
		start,
	});

	const queryHash = createHash("sha256").update(searchKey).digest("hex");

	const searchCachePath = getSearchCachePath(
		prefix,
		collectionRevision,
		queryHash,
	);

	const cachedSearch =
		await readJsonFile<CacheEnvelope<SearchResponse>>(searchCachePath);

	if (cachedSearch && isCacheFresh(cachedSearch.fetchedAt)) {
		return cachedSearch.data;
	}

	const searchParams = new URLSearchParams({
		query: normalizedQuery,
		prefix,
	});

	if (limit > 0) {
		searchParams.set("limit", String(limit));
	}

	if (start > 0) {
		searchParams.set("start", String(start));
	}

	const searchPath = `/search?${searchParams.toString()}`;
	const freshSearch = await fetchSearch(searchPath);

	const freshEnvelope = createCacheEnvelope(
		freshSearch.data,
		freshSearch.sourceHost,
		collectionRevision,
	);

	await writeJsonFile(searchCachePath, freshEnvelope);

	return freshEnvelope.data;
}
