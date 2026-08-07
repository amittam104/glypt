import { getCachedCollections } from "./iconify-client.js";

export type IconCollection = {
	name: string;
	prefix: string;
};

const ICON_LIBRARY_ALIASES = [
	{
		prefix: "lucide",
		aliases: ["lucide", "lucide icons", "lucide-react"],
	},
	{
		prefix: "hugeicons",
		aliases: [
			"huge icons",
			"hugeicons",
			"@hugeicons/react",
			"@hugeicons/core-free-icons",
		],
	},
	{
		prefix: "ph",
		aliases: ["phosphor", "phosphor icons", "@phosphor-icons/react"],
	},
	{
		prefix: "tabler",
		aliases: ["tabler", "tabler icons", "@tabler/icons-react"],
	},
	{
		prefix: "heroicons",
		aliases: ["heroicons", "hero icons", "@heroicons/react"],
	},
	{
		prefix: "radix-icons",
		aliases: ["radix", "radix icons", "@radix-ui/react-icons"],
	},
] as const;

function normalizeLibraryName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
}

export async function resolveIconCollection(
	library: string,
): Promise<IconCollection> {
	const normalizedLibrary = normalizeLibraryName(library);

	if (!normalizedLibrary) {
		throw new Error("Icon library is required");
	}

	const collections = await getCachedCollections();
	const aliasMatch = ICON_LIBRARY_ALIASES.find(({ aliases }) =>
		aliases.some((alias) => normalizeLibraryName(alias) === normalizedLibrary),
	);

	if (aliasMatch) {
		const collection = collections[aliasMatch.prefix];

		if (collection) {
			return { name: collection.name, prefix: aliasMatch.prefix };
		}
	}

	const prefixMatch = Object.keys(collections).find(
		(prefix) => normalizeLibraryName(prefix) === normalizedLibrary,
	);

	if (prefixMatch) {
		return { name: collections[prefixMatch].name, prefix: prefixMatch };
	}

	const nameMatches = Object.entries(collections).filter(
		([, collection]) =>
			normalizeLibraryName(collection.name) === normalizedLibrary,
	);

	if (nameMatches.length === 1) {
		const [prefix, collection] = nameMatches[0];

		return { name: collection.name, prefix };
	}

	if (nameMatches.length > 1) {
		throw new Error(`Icon library is ambiguous: ${library}`);
	}

	throw new Error(`Unknown icon library: ${library}`);
}
