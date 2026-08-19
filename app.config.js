// Extends app.json; injects the dev-machine API key for simulator use.
// At runtime a key saved in Settings (expo-secure-store) takes precedence.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? null,
  },
});
