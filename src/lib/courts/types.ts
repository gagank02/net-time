/** Times are America/Chicago wall-clock "HH:MM" (or "HH:MM:SS" from Postgres); dates "YYYY-MM-DD". */
export type HoursRow = {
	weekday: number; // 0 = Sunday
	opens: string;
	closes: string;
	seasonStart: string | null;
	seasonEnd: string | null;
};

export type ClassRow = {
	title: string;
	weekday: number;
	starts: string;
	ends: string;
	courtsUsed: number;
	seasonStart: string;
	seasonEnd: string;
};

export type CourtStatus =
	| { state: 'open'; until: string; nextClassAt: string | null }
	| { state: 'class'; until: string; courtsFree: number; titles: string[] }
	| {
			state: 'closed';
			nextOpen: { time: string; inDays: number; weekday: number; date: string } | null;
	  };

// 'fee' = pay to play on site (e.g. Diversey's clay courts); 'reservation' = book ahead at bookingUrl.
export type Access = 'free' | 'reservation' | 'fee';

/** One row of the /courts list (also the shape the map and near-me sorting use). */
export type CourtListItem = {
	slug: string;
	name: string;
	lat: number;
	lng: number;
	courtCount: number;
	lights: boolean | null;
	surface: 'hard' | 'clay' | 'grass' | 'other' | null;
	indoor: boolean;
	access: Access;
	bookingUrl: string | null;
	communityArea: string;
	hours: HoursRow[];
	/** Seasonal courts only, e.g. "open mid-May to mid-October". */
	seasonNote: string | null;
	classes: ClassRow[];
};

/** Community-area or ZIP centroid: a coarse "near" point that is fine to put in a URL. */
export type Area = { slug: string; name: string; lat: number; lng: number };
export type Zip = { zip: string; lat: number; lng: number };

export type ClassDetail = ClassRow & { sourceUrl: string; verifiedAt: string };

/** Everything the /courts/[slug] page shows. */
export type CourtDetail = Omit<CourtListItem, 'classes'> & {
	address: string | null;
	osmIds: string[];
	verifiedAt: string;
	hoursSourceUrl: string | null;
	classes: ClassDetail[];
};
