import {
	type CacheEnvelope,
	createCacheEnvelope,
	getCollectionCachePath,
	isCacheFresh,
	readJsonFile,
	writeJsonFile,
} from "./cache.js";

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

export async function requestJson<T>(path: string): Promise<T> {
	const signal = AbortSignal.timeout(5000);

	try {
		const res = await fetch(`https://api.iconify.design/${path}`, {
			signal,
			headers: {
				"User-Agent": "glypt/0.1.0",
			},
		});

		if (!res.ok)
			throw new Error(`Iconify request failed with status ${res.status}`);

		return (await res.json()) as T;
	} catch (error) {
		throw new Error(`Failed to fetch Iconify path ${path}`, {
			cause: error,
		});
	}
}

export async function getCollectionVersion(prefix: string): Promise<string> {
	try {
		const res = await requestJson<LastModifiedResponse>(
			`last-modified?prefix=${encodeURIComponent(prefix)}`,
		);

		const revision = res.lastModified[prefix];

		if (!revision) throw new Error(`No revision found for ${prefix}`);

		return String(revision);
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : String(error));
	}
}

export async function fetchCollection(
	prefix: string,
): Promise<CollectionResponse> {
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
			"https://api.iconify.design/",
			currentVersion,
		);

		await writeJsonFile(cachePath, refreshedEnvelop);

		return cached.data;
	}

	const freshCollection = await fetchCollection(prefix);

	const freshEnvelop = createCacheEnvelope(
		freshCollection,
		"https://api.iconify.design/",
		currentVersion,
	);

	await writeJsonFile(cachePath, freshEnvelop);

	return freshCollection;
}
