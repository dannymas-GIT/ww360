/** Time-of-day salutation for WW360 heroes and the app shell top bar. */
export function ww360Greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type GreetingUser = {
  full_name?: string | null;
  username?: string | null;
};

/** First name when possible; falls back to full name, then a readable username. */
export function userDisplayName(user?: GreetingUser | null): string {
  const full = user?.full_name?.trim();
  if (full) {
    const first = full.split(/\s+/)[0];
    return first || full;
  }
  const username = user?.username?.trim();
  if (!username) return 'there';
  const slug = username.split('-')[0] ?? username;
  if (!slug) return username;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** "Good afternoon, Jenny — …" for page heroes and shell chrome. */
export function ww360PersonalizedTitle(user: GreetingUser | null | undefined, tail: string): string {
  const trimmed = tail.trim();
  if (!trimmed) return `${ww360Greeting()}, ${userDisplayName(user)}`;
  return `${ww360Greeting()}, ${userDisplayName(user)} — ${trimmed}`;
}
