/**
 * Websites we take individual facts from (hours, seasons, fees, booking links), credited on /data.
 * Every https link in data/*.json must be on one of these hosts (or OSM / the City portal, credited
 * separately); src/lib/sources.test.ts enforces it, so a new source can't ship uncredited.
 */
export const facilitySources = [
	{
		host: 'www.chicagoparkdistrict.com',
		name: 'Chicago Park District',
		owner: 'Chicago Park District',
		use: 'McFetridge Sports Center hours'
	},
	{
		host: 'www.maggiedaleypark.com',
		name: 'Maggie Daley Park',
		owner: 'Chicago Park District, managed by Legends Global',
		use: 'Maggie Daley Park court hours and lights'
	},
	{
		host: 'www.mcfetridgesportscenter.com',
		name: 'McFetridge Sports Center',
		owner: 'Chicago Park District, managed by Legends Global',
		use: 'the McFetridge booking link'
	},
	{
		host: 'www.diverseytenniscenter.com',
		name: 'Diversey Tennis Center',
		owner: 'Lincoln Park Tennis Association',
		use: 'Diversey season, hours, fees and booking link'
	}
] as const;

/**
 * Credited on /data in their own entries. apm.activecommunities.com is the Park District's
 * registration site: the activities dataset's sign-up links, credited with that dataset.
 */
export const datasetHosts = [
	'www.openstreetmap.org',
	'data.cityofchicago.org',
	'apm.activecommunities.com'
];
