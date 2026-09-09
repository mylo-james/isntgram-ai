# Fictional demo community

This optional demo dataset contains 20 fictional adult profiles and 150 locally stored photos. Profile activity varies
from 24 posts to none, with four lurkers. Saved captions, biographies, interests and comments were drafted by low-effort
agents and reviewed against the actual images. Avatars were generated separately using the built-in image generation
tool. The application makes no AI calls.

Enable it with `DEMO_ENABLED=true` and `DEMO_CONTENT_SOURCE=community` on the API, and
`NEXT_PUBLIC_DEMO_CONTENT_SOURCE=community` on the web app. Start a new demo session to populate it. The web deployment
must include `public/demo-community`; photo and avatar URLs use that same-origin path. The guarded `curated` corpus
remains a separate content source.

New visitors begin with an empty personal profile and follow a selection of the community. Each fictional profile has
its own portfolio and an uneven set of follows, likes and comments. The seed timeline spreads posts across approximately
six weeks. Existing seed records retain their timestamps and edits on repeat runs. The transaction refuses conflicting
real usernames and does not delete existing accounts or posts.

## Dataset and sources

- `apps/api/src/auth/demo/data/community.ts`: profiles, voices, backstories, posts, accessible photo descriptions,
  comments, likes and follows.
- `apps/web/public/demo-community/photos`: 150 fixed 800 × 800 JPEG images (approximately 12 MB total).
- `apps/web/public/demo-community/credits.json`: original photographer, source page, fixed download URL and SHA-256 for
  each photo.
- `apps/web/public/demo-community/avatars`: generated avatars, named by profile key.
- `apps/web/public/demo-community/avatar-prompts.json`: saved generation prompts and provenance.

The source photographs come from [Lorem Picsum](https://picsum.photos), which uses
[Unsplash photographs](https://unsplash.com/license). Source credits stay attached to the catalog. Fictional profile
names and stories do not identify the real photographers or people depicted in the stock photos. The demo banner
discloses the fictional community and generated avatars.

## Verification

The community seeder tests exercise a real disposable SQLite database: exact profile/post counts, lurker distribution,
photograph hashes, foreign-key references, repeat seeding, stored counters, preservation of visitor content and rollback
on a real username conflict. No retained database migration is needed to preview this dataset.

## The cast

| Profile                       | Posts | Interests                           |
| ----------------------------- | ----: | ----------------------------------- |
| Mara Lin (@maralin)           |    24 | city walks, coast, architecture     |
| Samir Elias (@samirelias)     |    12 | street scenes, city, still life     |
| Nora Okafor (@noraokafor)     |     7 | nature, street scenes, food         |
| Felix Hart (@felixhart)       |     5 | architecture, city, design          |
| Inés Valera (@inesvalera)     |     2 | coast, nature, flowers              |
| Theo Mercer (@theomercer)     |     0 | coast, mountains, city              |
| Aïsha Benali (@aishabenali)   |    20 | street scenes, architecture, nature |
| Jonas Berg (@jonasberg)       |    16 | mountains, coast, weather           |
| Priya Desai (@priyadesai)     |     9 | flowers, still life, city           |
| Luca Russo (@lucarusso)       |     4 | street scenes, city, architecture   |
| Mei Wen (@meiwen)             |     1 | nature, parks, city                 |
| Omar Said (@omarsaid)         |     0 | coast, city, mountains              |
| Clare Nwosu (@clarenwosu)     |     0 | street scenes, city, food           |
| Tomasz Król (@tomaszkrol)     |    18 | architecture, city, trains          |
| Sofía Álvarez (@sofiaalvarez) |    14 | coast, nature, flowers              |
| Dev Shah (@devshah)           |    10 | nature, mountains, city             |
| Hana Kovač (@hanakovac)       |     6 | architecture, nature, flowers       |
| Eli Brown (@elibrown)         |     1 | city, coast, nature                 |
| Yuki Tanaka (@yukitanaka)     |     1 | trains, city, architecture          |
| Rúben Silva (@rubensilva)     |     0 | coast, city, mountains              |
