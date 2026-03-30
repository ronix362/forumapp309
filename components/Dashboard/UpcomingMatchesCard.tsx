'use client';

type MatchItem = {
  id: number;
  date: string;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeTeam?: { logoUrl: string; name: string } | null;
  awayTeam?: { logoUrl: string; name: string } | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

function TeamLogo({
  logoUrl,
  name,
}: {
  logoUrl?: string | null;
  name: string;
}) {
  if (!logoUrl) {
    return (
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
        {name.slice(0, 3).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={name}
      className="w-14 h-14 rounded-full object-contain bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-1"
    />
  );
}

export default function UpcomingMatchesCard({ matches }: { matches: MatchItem[] }) {
  return (
    <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-700 dark:to-indigo-700 p-4">
        <h2 className="text-lg font-semibold text-white">Favorite Team Upcoming Matches</h2>
        <p className="text-xs text-blue-50 mt-1">Next scheduled fixtures</p>
      </div>

      <div className="p-4">
        {matches.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No matches found.
          </p>
        ) : (
          <ul className="space-y-4">
            {matches.map((match) => {
              const homeName = match.homeTeam?.name ?? `Team ${match.homeTeamId}`;
              const awayName = match.awayTeam?.name ?? `Team ${match.awayTeamId}`;

              return (
                <li
                  key={match.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4"
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex flex-col items-center text-center">
                      <TeamLogo logoUrl={match.homeTeam?.logoUrl} name={homeName} />
                      <span className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        {homeName}
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm">
                        <span className="text-lg font-extrabold text-gray-900 dark:text-white">
                          VS
                        </span>
                      </div>
                      <span className="mt-2 text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Upcoming
                      </span>
                    </div>

                    <div className="flex flex-col items-center text-center">
                      <TeamLogo logoUrl={match.awayTeam?.logoUrl} name={awayName} />
                      <span className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        {awayName}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <span className="inline-flex rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs text-blue-700 dark:text-blue-300">
                      {new Date(match.date).toLocaleString()}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}