import { access, stat } from "node:fs/promises";
import {
	dirname,
	isAbsolute,
	join,
	relative,
	resolve,
	sep,
} from "node:path";

export type StaticPackageImport = {
	source: string;
	packageName: string;
	line: number;
};

const WORKSPACE_MARKERS = ["pnpm-workspace.yaml", "pnpm-workspace.yml"];

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);

		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return false;
		}

		throw error;
	}
}

export async function validateProjectPath(
	projectPath: string,
): Promise<string> {
	const projectRoot = resolve(projectPath);
	let projectStats: Awaited<ReturnType<typeof stat>>;

	try {
		projectStats = await stat(projectRoot);
	} catch (error) {
		throw new Error(`Cannot access project path: ${projectRoot}`, {
			cause: error,
		});
	}

	if (!projectStats.isDirectory()) {
		throw new Error(`Project path is not a directory: ${projectRoot}`);
	}

	return projectRoot;
}

export async function validateTargetFile(
	projectRoot: string,
	targetFile?: string,
): Promise<string | undefined> {
	if (!targetFile) {
		return undefined;
	}

	const absoluteProjectRoot = resolve(projectRoot);
	const absoluteTargetFile = resolve(absoluteProjectRoot, targetFile);
	const relativeTargetPath = relative(
		absoluteProjectRoot,
		absoluteTargetFile,
	);

	if (
		relativeTargetPath === ".." ||
		relativeTargetPath.startsWith(`..${sep}`) ||
		isAbsolute(relativeTargetPath)
	) {
		throw new Error(
			`Target file must be inside the project: ${absoluteTargetFile}`,
		);
	}

	let targetStats: Awaited<ReturnType<typeof stat>>;

	try {
		targetStats = await stat(absoluteTargetFile);
	} catch (error) {
		throw new Error(`Cannot access target file: ${absoluteTargetFile}`, {
			cause: error,
		});
	}

	if (!targetStats.isFile()) {
		throw new Error(`Target path is not a file: ${absoluteTargetFile}`);
	}

	return absoluteTargetFile;
}

export async function findNearestPackageRoot(
	startDirectory: string,
): Promise<string | null> {
	let currentDirectory = resolve(startDirectory);

	while (true) {
		const packageJsonPath = join(currentDirectory, "package.json");

		if (await pathExists(packageJsonPath)) {
			return currentDirectory;
		}

		const parentDirectory = dirname(currentDirectory);

		if (parentDirectory === currentDirectory) {
			return null;
		}

		currentDirectory = parentDirectory;
	}
}

export async function findWorkspaceRoot(
	startDirectory: string,
): Promise<string | null> {
	let currentDirectory = resolve(startDirectory);

	while (true) {
		for (const marker of WORKSPACE_MARKERS) {
			if (await pathExists(join(currentDirectory, marker))) {
				return currentDirectory;
			}
		}

		const parentDirectory = dirname(currentDirectory);

		if (parentDirectory === currentDirectory) {
			return null;
		}

		currentDirectory = parentDirectory;
	}
}

export function getPackageRoot(moduleSpecifier: string): string | null {
	if (
		moduleSpecifier.startsWith(".") ||
		moduleSpecifier.startsWith("/") ||
		moduleSpecifier.startsWith("node:") ||
		moduleSpecifier.startsWith("#") ||
		moduleSpecifier.startsWith("@/") ||
		moduleSpecifier.startsWith("~/")
	) {
		return null;
	}

	const segments = moduleSpecifier.split("/");

	if (moduleSpecifier.startsWith("@")) {
		if (segments.length < 2 || !segments[1]) {
			return null;
		}

		return segments.slice(0, 2).join("/");
	}

	return segments[0] ?? null;
}

export function extractStaticPackageImports(
	sourceText: string,
): StaticPackageImport[] {
	const matches: StaticPackageImport[] = [];

	const staticImportPattern =
		/(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

	for (const match of sourceText.matchAll(staticImportPattern)) {
		const moduleSpecifier = match[1];
		const matchIndex = match.index;

		const packageName = getPackageRoot(moduleSpecifier);

		if (!packageName) {
			continue;
		}

		const line = sourceText.slice(0, matchIndex).split("\n").length;

		matches.push({
			source: moduleSpecifier,
			packageName,
			line,
		});
	}

	return matches;
}
