# Isntgram v1 demo playbooks

These playbooks describe a local fictional-fixture demonstration. They are not release claims. Begin from the local
operator guide, stop when a guard refuses, and preserve retained rows and objects. Do not reset data merely to repeat a
demonstration.

## Read-only accessibility and input-readiness check

Run the named read-only accessibility subset only with a qualified owned stack. It may inspect existing UI states and
inject a non-persistent failure, but must not create a comment, start or stop a service, or alter application data. A
desktop browser check is not physical-phone or screen-reader certification.

## PB-01: publish and retain a text post

**Inputs:** a working guarded API/web pair, an ordinary fixture account, a unique short text draft, and a browser.

**Actions:** sign in through the web UI; tab to the labeled composer; enter the draft; publish once; reload the feed;
open the post detail; and run the source-owned read-only post verification.

**Required outcome:** keyboard focus and request feedback are visible; one post exists; the same content remains after
reload and a fresh browser session; and the web, API, and persistent record agree. A timeout, network loss, or unknown
publish result retains the original draft and replay intent. It must not silently create a second post.

## PB-02: find, follow, react, and see a notification

**Inputs:** two ordinary fixture actors, a known ordinary post, an initial no-follow/no-engagement state, and distinct
browser sessions for actor and recipient.

**Actions:** search for the recipient and confirm visible results match the final query; wait for confirmed follow
state; follow once; like the known post; add one run-labeled comment; then open recipient notifications and follow each
target link.

**Required outcome:** no stale search result replaces the latest query; each social relation changes once; counters
match corresponding rows; recipient- scoped notifications identify the actor and target; and a failed mutation leaves
the last confirmed UI state visible with actionable feedback. Do not fabricate fixture engagement as proof or recreate
an already-retained first-run relation.

## PB-03: register, recover an edit, and own the profile

**Inputs:** one new run-specific ordinary account identity and a known existing handle used only to exercise the
duplicate branch.

**Actions:** register; sign in using the supported email identifier; open the owner profile; attempt the duplicate
handle; exercise unavailable/update-failure state; correct the form; save a permitted handle; then log out.

**Required outcome:** login copy names email, field errors are announced and preserve inputs, controls recover, a
successful handle updates profile and navigation destinations, and logout invalidates the prior API session without
placing its token in evidence. Retain the account until an explicit cleanup policy exists.

## PB-04: publish a curated photo

**Inputs:** an approved image with checksum, caption, and alternative text; an ordinary account; qualified local
storage; and a working API/web pair.

**Actions:** select the image by keyboard; confirm preview; remove and reselect it; demonstrate invalid or
stalled-upload recovery with the draft retained; then upload and publish once. Reload the feed and direct post.

**Required outcome:** invalid or interrupted upload creates no false photo post; a successful post binds the owner,
upload, object checksum, bytes, type, and published key; the image renders with the selected caption and alternative
text; and foreign ownership or a missing object is refused. Do not export a signed PUT URL, secret, or raw object-store
log.

## PB-06: one supervised recovery

**Inputs:** a verified foreground API/web pair, a retained known post, a fresh owned database identity, and an unrelated
listener identity recorded without connecting or signalling it.

**Actions:** after ordinary tests finish, use the guarded database stop command once. Set a fresh UUID request ID on the
feed document navigation and observe the visible feed failure and Retry path. Use the live API launch receipt to bind
its private log and capture exactly one matching safe failure record. Restart the same owned cluster, wait for semantic
readiness, select Retry, and re-read the retained post. Stop foreground application sessions when complete.

**Required outcome:** a request-linked final API failure record exists without duplicate success logging; retry recovers
the same retained record and cluster identity; and unrelated processes remain unchanged. Do not repeat the outage
automatically or use a kill-by-port, broad process signal, reset, migration, or cleanup.

## Private phone demonstration

The former AI exercise (PB-05) was retired when AI assistance was removed.

A private phone demonstration must not become a public remote-access claim and must preserve the local operational
storage boundary. It remains distinct from a physical-phone observation.

## Supplemental test budgets

The two keyboard cases create one text post at each of 1280px and 390px. Each uses real Tab and Enter on the existing
Post button, then checks one BFF 201, reload, a fresh session and read-only persistence verification.

The separate notification-pagination case creates two ordinary actors, one recipient post, 21 comments and 21 resulting
notifications: 45 rows. Its first 20 notifications come from the real server render. Only the first next-page request
fails synthetically. Explicit retry must use the same cursor, preserve the first page and return the real final record.
This supplements PB-02; it does not reset or repeat PB-02's original relationship fixture.

The upload-timeout case creates one pending intent, holds its real browser PUT before storage and observes the unchanged
15-second product deadline. It must retain the caption and selection, create no post and leave no object. The
uncertain-publication case creates one intent and one post, permits a real PUT and server commit, withholds the response
until the unchanged 30-second deadline, and explicitly retries the same upload ID and content. One final post and one
published object must survive fresh-session and byte verification. Both held requests are settled in a finalizer without
another mutation.

Together these five cases create at most 50 application rows and one pending object plus its published copy. Their
private receipts distinguish synthetic failure injection from actual server/database/storage effects. After a partial
run, inventory effects before deciding what remains. Separate native PostgreSQL tests have their own bounded
retained-row allowance; a pass does not replenish that allowance.
