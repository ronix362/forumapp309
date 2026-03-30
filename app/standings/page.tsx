'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link'; // Import Link

// This type perfectly matches the data your backend sends
type StandingsRow = {
  position: number;
  team: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export default function StandingsPage() {
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const res = await fetch('/api/matches/standings');
        if (!res.ok) {
          throw new Error('Failed to load standings');
        }
        const data = await res.json();
        setStandings(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStandings();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">Loading league table...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 text-center">
          <span className="text-4xl block mb-2">⚠️</span>
          <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Oops!</h2>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-5xl mx-auto">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            League Table
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Current standings for the 2025/2026 Premier League season.
          </p>
        </div>

        {/* The Table Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              
              {/* Table Headers */}
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-4 text-center w-12">Pos</th>
                  <th className="py-4 px-4">Club</th>
                  <th className="py-4 px-4 text-center">Played</th>
                  <th className="py-4 px-4 text-center hidden sm:table-cell">Won</th>
                  <th className="py-4 px-4 text-center hidden sm:table-cell">Drawn</th>
                  <th className="py-4 px-4 text-center hidden sm:table-cell">Lost</th>
                  <th className="py-4 px-4 text-center hidden md:table-cell">GF</th>
                  <th className="py-4 px-4 text-center hidden md:table-cell">GA</th>
                  <th className="py-4 px-4 text-center">GD</th>
                  <th className="py-4 px-4 text-center text-blue-600 dark:text-blue-400 font-extrabold text-sm">Pts</th>
                </tr>
              </thead>
              
              {/* Table Body */}
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {standings.map((row) => (
                  <tr 
                    key={row.team.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                  >
                    {/* Position */}
                    <td className="py-3 px-4 text-center">
                      <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-sm font-bold ${
                        row.position <= 4 ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 
                        row.position >= 18 ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : 
                        'text-gray-700 dark:text-gray-300'
                      }`}>
                        {row.position}
                      </span>
                    </td>
                    
                    {/* CHANGED: Club Name & Crest wrapped in a Link */}
                    <td className="py-3 px-4">
                      <Link 
                        href={`/teams/${row.team.id}`}
                        className="flex items-center gap-3 w-fit"
                      >
                        <img 
                          src={row.team.crest} 
                          alt={`${row.team.name} crest`} 
                          className="w-8 h-8 object-contain hover:scale-110 transition-transform duration-200"
                          loading="lazy"
                        />
                        <span className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {row.team.name}
                        </span>
                      </Link>
                    </td>

                    {/* Stats */}
                    <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300 font-medium">{row.playedGames}</td>
                    <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400 hidden sm:table-cell">{row.won}</td>
                    <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400 hidden sm:table-cell">{row.draw}</td>
                    <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400 hidden sm:table-cell">{row.lost}</td>
                    
                    <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400 hidden md:table-cell">{row.goalsFor}</td>
                    <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400 hidden md:table-cell">{row.goalsAgainst}</td>
                    <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300 font-medium">
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>
                    
                    {/* Total Points */}
                    <td className="py-3 px-4 text-center font-extrabold text-gray-900 dark:text-white text-base">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </div>

      </div>
    </div>
  );
}