'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Team = {
  id: number;
  name: string;
  shortName: string;
  logoUrl: string | null; 
};

type Match = {
  id: number;
  date: string;
  matchday: number;
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  location: string;
  homeTeam: Team;
  awayTeam: Team;
};

const ITEMS_PER_PAGE = 12;

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<{ id: number, name: string }[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all'); 
  const [matchdayFilter, setMatchdayFilter] = useState<string>(''); 
  const [teamFilter, setTeamFilter] = useState<string>(''); 
  
  // NEW: Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch('/api/teams');
        if (res.ok) {
          const data = await res.json();
          setTeams(data.teams || data);
        }
      } catch (err) {
        console.error("Failed to fetch teams", err);
      }
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    const fetchMatches = async () => {
      setIsLoading(true);
      setError(null);
      // Reset to page 1 whenever filters change
      setCurrentPage(1);
      
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (matchdayFilter) params.append('matchday', matchdayFilter);
        if (teamFilter) params.append('teamId', teamFilter);

        const res = await fetch(`/api/matches/search?${params.toString()}`);
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.errors?.join(', ') || 'Failed to fetch matches');
        }

        const data = await res.json();
        setMatches(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchMatches();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [statusFilter, matchdayFilter, teamFilter]);

  const formatMatchDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(matches.length / ITEMS_PER_PAGE) || 1;
  const paginatedMatches = matches.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111827] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 bg-white dark:bg-[#1f2937] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Fixtures & Results
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Browse the schedule, live scores, and past match details.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
              {['all', 'upcoming', 'past'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-2 text-sm font-bold capitalize rounded-md transition-all ${
                    statusFilter === s 
                      ? 'bg-white dark:bg-[#374151] text-blue-600 dark:text-blue-400 shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="team" className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Team:
              </label>
              <select
                id="team"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
              >
                <option value="">All Teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="matchday" className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Matchday:
              </label>
              <select
                id="matchday"
                value={matchdayFilter}
                onChange={(e) => setMatchdayFilter(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
              >
                <option value="">All</option>
                {Array.from({ length: 38 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>MD {num}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 text-center font-medium">
            Error: {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#1f2937] rounded-2xl border border-gray-200 dark:border-gray-700">
            <span className="text-4xl block mb-3 opacity-50">🏟️</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No matches found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* USE paginatedMatches instead of matches */}
              {paginatedMatches.map((match) => (
                <div 
                  key={match.id} 
                  className="bg-white dark:bg-[#1f2937] rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Matchday {match.matchday}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      match.completed 
                        ? 'bg-gray-100 dark:bg-[#374151] text-gray-600 dark:text-gray-300' 
                        : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                    }`}>
                      {match.completed ? 'FT' : 'Upcoming'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center my-4 h-24">
                    {/* Home Team Link */}
                    <Link 
                      href={`/teams/${match.homeTeam.id}`}
                      className="flex flex-col items-center gap-2 w-1/3 text-center h-full justify-start group"
                    >
                      <img 
                        src={match.homeTeam.logoUrl || `https://ui-avatars.com/api/?name=${match.homeTeam.shortName || match.homeTeam.name || 'H'}&background=random&color=fff&rounded=true&bold=true`} 
                        alt={match.homeTeam.shortName || 'Home'} 
                        className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" 
                        loading="lazy" 
                        onError={(e) => { 
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${match.homeTeam.shortName || match.homeTeam.name || 'H'}&background=random&color=fff&rounded=true&bold=true`; 
                        }}
                      />
                      <span 
                        className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 text-balance leading-tight group-hover:text-blue-500 transition-colors"
                        title={match.homeTeam.name}
                      >
                        {match.homeTeam.shortName || match.homeTeam.name}
                      </span>
                    </Link>

                    {/* Score */}
                    <div className="flex flex-col items-center justify-start w-1/3 h-full pt-1">
                      <div className="flex gap-2 items-center text-3xl font-extrabold text-gray-900 dark:text-white bg-gray-50 dark:bg-[#111827] px-4 py-2 rounded-lg border border-gray-100 dark:border-gray-800 shadow-inner">
                        <span>{match.homeScore ?? '-'}</span>
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                        <span>{match.awayScore ?? '-'}</span>
                      </div>
                    </div>

                    {/* Away Team Link */}
                    <Link 
                      href={`/teams/${match.awayTeam.id}`}
                      className="flex flex-col items-center gap-2 w-1/3 text-center h-full justify-start group"
                    >
                      <img 
                        src={match.awayTeam.logoUrl || `https://ui-avatars.com/api/?name=${match.awayTeam.shortName || match.awayTeam.name || 'A'}&background=random&color=fff&rounded=true&bold=true`} 
                        alt={match.awayTeam.shortName || 'Away'} 
                        className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" 
                        loading="lazy" 
                        onError={(e) => { 
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${match.awayTeam.shortName || match.awayTeam.name || 'A'}&background=random&color=fff&rounded=true&bold=true`; 
                        }}
                      />
                      <span 
                        className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 text-balance leading-tight group-hover:text-blue-500 transition-colors"
                        title={match.awayTeam.name}
                      >
                        {match.awayTeam.shortName || match.awayTeam.name}
                      </span>
                    </Link>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span>📅</span>
                      <span>{formatMatchDate(match.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span>🏟️</span>
                      <span className="truncate" title={match.location}>{match.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* --- PAGINATION CONTROLS --- */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 bg-white dark:bg-[#1f2937] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mt-8">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:inline">Page</span>
                  <input 
                    type="number" 
                    min={1} 
                    max={totalPages} 
                    value={currentPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      }
                    }}
                    className="w-16 text-center text-sm font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md py-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">of {totalPages}</span>
                </div>

                <button 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}