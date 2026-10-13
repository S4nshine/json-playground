/** App-level configuration. Override via a `.env.local` file (see README). */
export const GITHUB_URL: string = import.meta.env.VITE_GITHUB_URL || "https://github.com/your-org/json-playground";

export const APP_NAME = "JSON Playground";
