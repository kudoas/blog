import { z } from 'astro/zod';

const text = z.string().trim().min(1);
const date = z.union([text, z.date()]).pipe(z.coerce.date());
const terms = z.array(text).default([]);

export const postSchema = z.object({
  title: text,
  date,
  draft: z.boolean().default(false),
  description: z.string().default(''),
  author: text.default('daichi'),
  tags: terms,
  categories: terms,
  images: z.array(text).default([]),
});

export const externalArticleSchema = z.object({
  id: text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a kebab-case identifier'),
  title: text,
  url: z.url({ protocol: /^https$/ }),
  date,
  source: text,
  tags: terms,
  categories: terms,
  description: z.string().default(''),
});

export const externalArticlesSchema = z.array(externalArticleSchema).superRefine((items, context) => {
  for (const key of ['id', 'url'] as const) {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item[key])) {
        context.addIssue({ code: 'custom', path: [index, key], message: `Duplicate ${key}: ${item[key]}` });
      }
      seen.add(item[key]);
    });
  }
});

export type PostData = z.infer<typeof postSchema>;
export type ExternalArticle = z.infer<typeof externalArticleSchema>;
