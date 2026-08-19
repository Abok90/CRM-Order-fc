/**
 * Supabase caps every `select` at a fixed number of rows (1000 by default), and
 * it does so silently — a total summed from a capped result is simply wrong.
 * This pages through the whole result set with `.range()` instead.
 *
 * `buildQuery` must return a fresh query builder on each call.
 */
export async function fetchAllRows(buildQuery, { pageSize = 1000, maxRows = 100000 } = {}) {
  const all = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}
