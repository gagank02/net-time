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

## Obligations we follow

- Show the City disclaimer above, verbatim, in the app (`/data`, linked from every page footer) and here.
- Credit OpenStreetMap (footer, `/data`, and the map) and keep the derived seed public under ODbL.
- If the City asks us to stop using any dataset: remove its fields from the seed, re-run `npm run db:seed`, and deploy.
- Report errors we find in City data back to the City.
