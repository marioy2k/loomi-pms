export function licenceDaysRemaining(license, now = Date.now()) {
  if (!license.valid || license.term === 'permanent') return null;
  const expiry = Date.parse(license.expiresAt);
  return Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - now) / 86400000)) : null;
}
// This object crosses the server/client boundary; never pass the complete licence as page props.
export function activationDetails(license, superAdmin) {
  return superAdmin ? {error: license.error, installationId: license.installationId} : {};
}
