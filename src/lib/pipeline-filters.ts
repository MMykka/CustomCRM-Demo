export type PipelineFilters = {
  ownerIds: string[];
  valueMin: number | null;
  valueMax: number | null;
  staleOnly: boolean;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePipelineFilters(searchParams: Record<string, string | string[] | undefined>): PipelineFilters {
  const owners = first(searchParams.owner);
  const valueMin = first(searchParams.value_min);
  const valueMax = first(searchParams.value_max);

  return {
    ownerIds: owners ? owners.split(",").filter(Boolean) : [],
    valueMin: valueMin ? Number(valueMin) : null,
    valueMax: valueMax ? Number(valueMax) : null,
    staleOnly: first(searchParams.stale) === "1",
  };
}

export const STALE_DAYS = 14;

export function isDealStale(updatedAt: string): boolean {
  const updated = new Date(updatedAt).getTime();
  const thresholdMs = STALE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - updated > thresholdMs;
}
