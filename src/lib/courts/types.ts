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
