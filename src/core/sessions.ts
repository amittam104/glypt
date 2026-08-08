import { randomUUID } from "node:crypto";
import { getSessionCachePath, readJsonFile, writeJsonFile } from "./cache.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type IconSession = {
	schemaVersion: 1;
	sessionId: string;
	createdAt: string;
	expiresAt: string;
	library: string;
	prefix: string;
	refs: Record<string, string>;
};

export async function createIconSession(
	library: string,
	prefix: string,
	refs: Record<string, string>,
): Promise<IconSession> {
	const createdAt = new Date();
	const session: IconSession = {
		schemaVersion: 1,
		sessionId: randomUUID(),
		createdAt: createdAt.toISOString(),
		expiresAt: new Date(createdAt.getTime() + SESSION_TTL_MS).toISOString(),
		library,
		prefix,
		refs,
	};

	await writeJsonFile(getSessionCachePath(session.sessionId), session);

	return session;
}

export async function loadIconSession(sessionId: string): Promise<IconSession> {
	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			sessionId,
		)
	) {
		throw new Error("Invalid icon session ID");
	}

	const session = await readJsonFile<IconSession>(
		getSessionCachePath(sessionId),
	);

	if (!session) {
		throw new Error(`Icon session not found: ${sessionId}`);
	}

	const expiresAt = Date.parse(session.expiresAt);

	if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
		throw new Error(`Icon session has expired: ${sessionId}`);
	}

	return session;
}
