import yaml from 'js-yaml';

/**
 * Minimal, browser-safe frontmatter splitter. We deliberately parse the YAML
 * frontmatter ourselves with js-yaml (rather than pulling in gray-matter, which
 * depends on Node's Buffer) so the loader runs cleanly in the browser bundle.
 */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface Frontmatter {
  data: unknown;
  content: string;
}

export function parseFrontmatter(raw: string): Frontmatter {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { data: {}, content: raw.trim() };
  return {
    data: yaml.load(match[1]) ?? {},
    content: (match[2] ?? '').trim(),
  };
}

/** Parse a standalone YAML document (used for photo metadata sidecars). */
export function parseYaml(raw: string): unknown {
  return yaml.load(raw) ?? {};
}
