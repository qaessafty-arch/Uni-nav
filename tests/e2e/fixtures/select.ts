import type { Locator } from "@playwright/test";

/** Select the first <option> whose text matches `re`. */
export async function selectByText(select: Locator, re: RegExp) {
  const opts = await select.locator("option").evaluateAll((els) => els.map((e) => ({ v: (e as HTMLOptionElement).value, t: e.textContent ?? "" })));
  const hit = opts.find((o) => re.test(o.t));
  if (!hit) throw new Error(`No option matching ${re}`);
  await select.selectOption(hit.v);
}
