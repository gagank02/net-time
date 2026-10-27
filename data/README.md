# net-time data

Seed data loaded by `npm run db:seed`. Built by `npm run courts:build-seed` and reviewed by a person before commit.

## City of Chicago data disclaimer

Required by the [City of Chicago Data Terms of Use](https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html):

> “This site provides applications using data that has been modified for use from its original source, www.cityofchicago.org, the official website of the City of Chicago. The City of Chicago makes no claims as to the content, accuracy, timeliness, or completeness of any of the data provided at this site. The data provided at this site is subject to change at any time. It is understood that the data provided at this site is being used at one’s own risk.”

## Sources and licences

| Source                                                                                 | Owner                                               | Licence                                                    | Used for                               |
| -------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| [CPD Facilities `eix4-gf83`](https://data.cityofchicago.org/d/eix4-gf83) (Nov 2016)    | Chicago Park District                               | Public Domain                                              | Marking Park District tennis locations |
| [Boundaries - Community Areas `igwz-8jzy`](https://data.cityofchicago.org/d/igwz-8jzy) | City of Chicago                                     | City of Chicago Data Terms of Use                          | Neighborhood search                    |
| [Boundaries - ZIP Codes `unjd-c2ca`](https://data.cityofchicago.org/d/unjd-c2ca)       | City of Chicago, Dept. of Technology and Innovation | City of Chicago Data Terms of Use                          | ZIP search                             |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via Overpass API              | © OpenStreetMap contributors                        | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | Court locations, lights, surface       |
| Chicago Park District web pages (hand-entered, `sourceUrl` on each record)             | Chicago Park District                               | Facts only                                                 | Hours overrides, class schedules       |

`courts.seed.json` is a derived database of OpenStreetMap data and is made available under the **ODbL 1.0**.

## How the seed is built (and third-party fair use)

`npm run courts:build-seed` downloads four sources **once** and caches the raw responses in `.cache/` (gitignored, never redistributed). Re-runs use the cache; `--refresh` (or `--refresh=cpd`) re-downloads, which should be rare (e.g. once a season).

- **Overpass API** (overpass-api.de), following its [usage policy](https://wiki.openstreetmap.org/wiki/Overpass_API): one simple query with no per-element loops (spatial joins happen locally), an identifying User-Agent, a 60 s server timeout, one request at a time, a 30 s+ pause after 429/406/5xx, at most 3 attempts. The app never calls Overpass at runtime. For commercial use, switch to a [Geofabrik](https://download.geofabrik.de/) extract processed locally or a paid/self-hosted Overpass.
- **City of Chicago Data Portal**: three plain dataset downloads under the Data Terms of Use above.

Matching rules: a court site is a Park District location if a 2016 CPD tennis point is within 150 m, or it sits inside an OSM park that contains any CPD facility. Courts are named after the largest containing park, using everyday names ("Lincoln Park", not "Lincoln (Abraham) Park"). `courts.report.md` lists everything included only by the second rule and everything excluded, for human review.

## Obligations we follow

- Show the City disclaimer above, verbatim, in the app (`/data`, linked from every page footer) and here.
- Credit OpenStreetMap (footer, `/data`, and the map) and keep the derived seed public under ODbL.
- If the City asks us to stop using any dataset: remove its fields from the seed, re-run `npm run db:seed`, and deploy.
- Report errors we find in City data back to the City.
