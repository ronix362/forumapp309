'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Team = {
  id: number;
  name: string;
  shortName: string;
  logoUrl: string | null;
  venue: string | null;
};

type Match = {
  id: number;
  date: string;
  matchday: number;
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: Team;
  awayTeam: Team;
};

export default function TeamProfilePage() {
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        // 1. Fetch all teams and find the specific one 
        // (Since we don't have an /api/teams/[id] route yet, this is the quickest way)
        const teamRes = await fetch('/api/teams');
        if (teamRes.ok) {
          const data = await teamRes.json();
          const teamsArray = data.teams || data;
          const foundTeam = teamsArray.find((t: Team) => t.id.toString() === teamId);
          setTeam(foundTeam || null);
        }

        // 2. Fetch recent past matches for this specific team
        const matchesRes = await fetch(`/api/matches/search?teamId=${teamId}&status=past`);
        if (matchesRes.ok) {
          const matchesData = await matchesRes.json();
          // The API returns ascending (oldest first). We reverse it to get newest first, and take the top 5.
          const latestMatches = matchesData.reverse().slice(0, 5);
          setRecentMatches(latestMatches);
        }

      } catch (err) {
        console.error("Failed to fetch team data", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (teamId) {
      fetchTeamData();
    }
  }, [teamId]);

  const formatShortDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center py-20 bg-gray-50 dark:bg-[#111827]">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex justify-center py-20 bg-gray-50 dark:bg-[#111827]">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team not found.</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111827] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Team Header Info */}
        <div className="bg-white dark:bg-[#1f2937] p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 opacity-5 rounded-full blur-3xl -mr-20 -mt-20"></div>

          <img 
            src={team.logoUrl || `https://ui-avatars.com/api/?name=${team.shortName || team.name}&background=random&color=fff&rounded=true&bold=true`} 
            alt={team.name} 
            className="w-32 h-32 object-contain relative z-10" 
          />
          
          <div className="flex-1 text-center md:text-left relative z-10">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
              {team.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <span className="flex items-center gap-1">🏟️ {team.venue || 'Stadium TBD'}</span>
            </div>

            {/* Forum Link Button */}
            <Link 
              href={`/forums/team/${team.id}`} // Adjust this link later when you build the forums!
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-all hover:scale-105"
            >
              💬 Enter Team Forum
            </Link>
          </div>
        </div>

        {/* Recent Matches Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Recent Form</h2>
          
          {recentMatches.length === 0 ? (
            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-2xl border border-gray-200 dark:border-gray-700 text-center text-gray-500">
              No recent matches found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentMatches.map((match) => {
                // Determine if this team won, lost, or drew to color the border
                const isHome = match.homeTeam.id === team.id;
                const thisTeamScore = isHome ? match.homeScore : match.awayScore;
                const otherTeamScore = isHome ? match.awayScore : match.homeScore;
                
                let resultColor = "border-gray-200 dark:border-gray-700"; // Draw or unplayed
                if (thisTeamScore !== null && otherTeamScore !== null) {
                  if (thisTeamScore > otherTeamScore) resultColor = "border-green-500 dark:border-green-500"; // Win
                  if (thisTeamScore < otherTeamScore) resultColor = "border-red-500 dark:border-red-500"; // Loss
                }

                return (
                  <div 
                    key={match.id} 
                    className={`bg-white dark:bg-[#1f2937] rounded-2xl p-5 shadow-sm border-l-4 ${resultColor} border-y border-r hover:shadow-md transition-shadow flex flex-col justify-between`}
                  >
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Matchday {match.matchday}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 dark:bg-[#374151] text-gray-600 dark:text-gray-300">
                        FT
                      </span>
                    </div>

                    <div className="flex justify-between items-center my-2 h-20">
                      <div className="flex flex-col items-center gap-2 w-1/3 text-center h-full justify-start">
                        <img 
                          src={match.homeTeam.logoUrl || `https://ui-avatars.com/api/?name=${match.homeTeam.shortName || 'H'}&background=random&color=fff&rounded=true`} 
                          alt="Home" className="w-10 h-10 object-contain" 
                        />
                        <span className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 text-balance leading-tight">
                          {match.homeTeam.shortName || match.homeTeam.name}
                        </span>
                      </div>

                      <div className="flex flex-col items-center justify-start w-1/3 h-full pt-1">
                        <div className="flex gap-2 items-center text-xl font-extrabold text-gray-900 dark:text-white bg-gray-50 dark:bg-[#111827] px-3 py-1 rounded-lg border border-gray-100 dark:border-gray-800">
                          <span>{match.homeScore ?? '-'}</span>
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                          <span>{match.awayScore ?? '-'}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-2 w-1/3 text-center h-full justify-start">
                        <img 
                          src={match.awayTeam.logoUrl || `https://ui-avatars.com/api/?name=${match.awayTeam.shortName || 'A'}&background=random&color=fff&rounded=true`} 
                          alt="Away" className="w-10 h-10 object-contain" 
                        />
                        <span className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 text-balance leading-tight">
                          {match.awayTeam.shortName || match.awayTeam.name}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-3 border-t border-gray-100 dark:border-gray-700 text-center text-xs text-gray-500">
                      {formatShortDate(match.date)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}