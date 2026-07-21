export const browserDemoDataEnabled =
  import.meta.env.VITE_ARGUS_DEMO_ENABLED?.trim().toLocaleLowerCase("en-US") !== "false";

export function recordsVisibleInDemoMode<T extends { dataClassification: string }>(
  records: T[] | undefined,
  demoEnabled: boolean,
): T[] | undefined {
  if (!records) return undefined;
  return demoEnabled
    ? records
    : records.filter((record) => record.dataClassification !== "demonstration");
}
