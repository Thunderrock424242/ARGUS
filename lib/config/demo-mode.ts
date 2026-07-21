export const browserDemoDataEnabled =
  import.meta.env.VITE_ARGUS_DEMO_ENABLED?.trim().toLocaleLowerCase("en-US") !== "false";
