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
	| { state: 'closed'; nextOpen: { time: string; inDays: number; weekday: number } | null };

export type Access = 'free' | 'reservation';

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
	classes: ClassRow[];
};
