import { expect, test } from '@playwright/test';

test('keeps an item template for an empty collection', async ({ page }) => {
  await page.goto('/?q=outbox-probe-empty-list');
  await expect(page.locator('.article-list > li')).toHaveCount(0);

  const templateAvailable = await page.evaluate(() => {
    const runtime = (window as Window & { HerbRuntime?: { slots: {
      slot: (file: string, name: string, occurrence: number) => { index: number; type: string } | null;
      statics: { parked: (file: string, key: string) => DocumentFragment | null };
    } } }).HerbRuntime;
    if (!runtime) return false;
    const file = 'app/views/articles/index.html.erb';
    const collection = runtime.slots.slot(file, 'saved_articles', 0);
    if (!collection || collection.type !== 'collection') return false;
    return runtime.slots.statics.parked(file, `${collection.index}:item`) !== null;
  });

  expect(templateAvailable).toBe(true);
});
