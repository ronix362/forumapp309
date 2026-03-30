'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Team = {
  id: number;
  name: string;
  shortName: string;
  logoUrl: string | null;
  venue: string | null;
};

export default function TeamsDirectoryPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch('/api/teams');
        if (res.ok) {
          const data = await res.json();
          // Sort alphabetically by name
          const sortedTeams = (data.teams || data).sort((a: Team, b: Team) => 
            a.name.localeCompare(b.name)
          );
          setTeams(sortedTeams);
        }
      } catch (err) {
        console.error("Failed to fetch teams", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTeams();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111827] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="bg-white dark:bg-[#1f2937] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Clubs
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Select a club to view their details, recent matches, and join their dedicated forum.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {teams.map((team) => (
              <Link 
                href={`/teams/${team.id}`} 
                key={team.id}
                className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
              >
                <img 
                  src={team.logoUrl || `https://ui-avatars.com/api/?name=${team.shortName || team.name}&background=random&color=fff&rounded=true&bold=true`} 
                  alt={team.name} 
                  className="w-16 h-16 object-contain mb-3 group-hover:scale-110 transition-transform" 
                  loading="lazy"
                />
                <span className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 text-balance leading-tight">
                  {team.shortName || team.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}