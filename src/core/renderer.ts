import type { IconifyJSON } from "@iconify/types";
import { getIconData, iconToSVG, replaceIDs } from "@iconify/utils";
import { Resvg } from "@resvg/resvg-js";

const CELL_SIZE = 104;
const COLUMNS = 6;
const HEADER_HEIGHT = 56;
const ICON_SIZE = 52;
const LABEL_WIDTH = 140;

export type AtlasRow = {
	label: string;
	cells: { name: string; ref: string }[];
};

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&apos;",
		};

		return entities[character];
	});
}

function renderIconCell(
	iconSet: IconifyJSON,
	cell: AtlasRow["cells"][number],
	x: number,
	y: number,
): string {
	const icon = getIconData(iconSet, cell.name);

	if (!icon) {
		throw new Error(`Missing render data for icon: ${cell.name}`);
	}

	const renderedIcon = iconToSVG(icon, {
		width: ICON_SIZE,
		height: ICON_SIZE,
	});
	const attributes = Object.entries(renderedIcon.attributes)
		.map(([name, value]) => `${name}="${escapeXml(value)}"`)
		.join(" ");
	const iconOffset = (CELL_SIZE - ICON_SIZE) / 2;

	return `<g transform="translate(${x},${y})"><rect x="1" y="1" width="${CELL_SIZE - 2}" height="${CELL_SIZE - 2}" rx="10" fill="#ffffff" stroke="#e2e8f0"/><svg x="${iconOffset}" y="12" ${attributes} color="#1e293b">${replaceIDs(renderedIcon.body)}</svg><text x="${CELL_SIZE / 2}" y="88" fill="#64748b" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">${escapeXml(cell.ref)}</text></g>`;
}

export function renderAtlasPng(
	iconSet: IconifyJSON,
	rows: AtlasRow[],
	title: string,
): Buffer {
	const width = LABEL_WIDTH + COLUMNS * CELL_SIZE;
	const height = HEADER_HEIGHT + Math.max(1, rows.length) * CELL_SIZE;
	const content = rows
		.map((row, rowIndex) => {
			const y = HEADER_HEIGHT + rowIndex * CELL_SIZE;
			const label = `<text x="12" y="${y + 56}" fill="#334155" font-family="Arial, sans-serif" font-size="13" font-weight="600">${escapeXml(row.label.slice(0, 20))}</text>`;
			const cells = row.cells
				.map((cell, columnIndex) =>
					renderIconCell(
						iconSet,
						cell,
						LABEL_WIDTH + columnIndex * CELL_SIZE,
						y,
					),
				)
				.join("");

			return `${label}${cells}`;
		})
		.join("");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fafc"/><text x="12" y="30" fill="#0f172a" font-family="Arial, sans-serif" font-size="16" font-weight="600">${escapeXml(title)}</text>${content}</svg>`;

	return new Resvg(svg, { fitTo: { mode: "zoom", value: 2 } }).render().asPng();
}
