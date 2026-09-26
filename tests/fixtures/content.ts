import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

export const posts = readdirSync('content/ja/posts').filter((file) => file.endsWith('.md')).map((file) => {
  const raw = readFileSync(`content/ja/posts/${file}`, 'utf8');
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) throw new Error(`Missing front matter: ${file}`);
  const data = parse(frontmatter[1]) as { title: string; date: string; draft?: boolean; tags?: string[] };
  return { id: file.slice(0, -3), data };
}).filter(({ data }) => !data.draft);

export const external = parse(readFileSync('content/external.yaml', 'utf8')) as { title: string; url: string; date: string }[];
