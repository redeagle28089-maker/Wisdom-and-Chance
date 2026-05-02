// Single source of truth for admin identity (task #61).
//
// Admin permissions are tied to the registered admin account in the database
// (users.isAdmin). The email below is used in two narrow places:
//
//   1. Auto-promotion: when the holder of this email signs in via web SSO
//      (Replit OIDC or Google), replitAuth.upsertUser() sets users.isAdmin
//      to true so the registered account has admin permissions.
//   2. Mobile-spoof guard: server/mobileAuth.ts refuses the password-less
//      mobile login flow for this email so a stranger cannot obtain a JWT
//      bound to the admin account just by knowing the email.
//
// All admin authorization checks (isAdmin middleware, economyService) read
// the users.isAdmin flag from the database, NOT this email constant.
export const ADMIN_EMAIL = "redeagle28089@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
