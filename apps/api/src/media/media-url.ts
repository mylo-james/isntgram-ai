const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PUBLISHED_PATH = new RegExp(
  `^/published/(${UUID})/(${UUID.replace('[1-5]', '4')})$`,
);

export function projectMediaUrl(
  value: string | undefined,
  canonicalBase: string | undefined,
  displayBase: string | undefined,
): string | undefined {
  if (!value || !canonicalBase || !displayBase || value.includes('%'))
    return value;
  try {
    const media = new URL(value);
    const canonical = new URL(canonicalBase);
    const display = new URL(displayBase);
    if (
      media.href !== value ||
      canonical.href !== canonicalBase ||
      display.href !== displayBase ||
      media.username ||
      media.password ||
      media.search ||
      media.hash ||
      media.origin !== canonical.origin ||
      media.pathname.slice(0, canonical.pathname.length) !== canonical.pathname
    )
      return value;
    const suffix = media.pathname.slice(
      canonical.pathname.replace(/\/$/, '').length,
    );
    if (!PUBLISHED_PATH.test(suffix)) return value;
    return `${display.toString().replace(/\/$/, '')}${suffix}`;
  } catch {
    return value;
  }
}
