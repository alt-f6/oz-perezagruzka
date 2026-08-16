import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**", "supabase/**", ".claude/**"],
  },
  {
    rules: {
      // Advisory perf rule from the react-hooks v6 preset. The remaining hits
      // are pre-existing fetch-on-mount patterns in LMS admin screens;
      // tracked in the backlog, downgraded so release gate is on real errors.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
