# Curated demonstration fixtures

This finite set contains three attributed NPS Yellowstone photographs. The source collection identifies each subject,
photographer and year. Captions describe the images without claiming that the application author took them or visited
the locations. The two ordinary fixture accounts are fictional local test actors; fixture setup does not seed follows or
engagement.

- Source catalog: [NPS Northeast scenic album](https://www.nps.gov/features/yell/slidefile/scenics/mvnortheast/Page.htm)
- Reuse terms: [NPS image collection FAQ](https://www.nps.gov/features/yell/slidefile/faq.htm)
- Version: `isntgram-v1-curated-1`
- Original bytes, all three images: 1,359,406
- Validated bytes, all three images: 963,807

`content.json` records attribution, captions, stable fixture identifiers and image hashes. Exact original JPEGs are in
`images/`. The publication decoder uses Sharp 0.35.4 to validate format and size, remove metadata and produce the output
hashes recorded in the manifest. Copying these files does not create database rows or storage objects.

Keep attribution with the fixture. Do not hotlink images at runtime. Fixture application verifies identities and hashes,
reuses matching retained records and refuses conflicts. See [the local runbook](../../docs/v1-local.md) for the guarded
fixture commands.
