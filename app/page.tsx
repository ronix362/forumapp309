'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";

type TeamInfo = {
  id: number;
  name: string;
  shortName: string;
  logoUrl?: string | null;
  crest?: string | null;
};

type StandingsRow = {
  position: number;
  points: number;
  playedGames: number;
  team: TeamInfo;
};

type Match = {
  id: number;
  date: string;
  matchday: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
};

export default function Home() {
  const [topTeams, setTopTeams] = useState<StandingsRow[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setIsLoggedIn(true);
    }

    const fetchHomepageData = async () => {
      try {
        const [standingsRes, matchesRes] = await Promise.all([
          fetch('/api/matches/standings'),
          fetch('/api/matches/search?status=upcoming')
        ]);

        if (standingsRes.ok) {
          const standingsData = await standingsRes.json();
          setTopTeams(standingsData.slice(0, 5)); 
        }

        if (matchesRes.ok) {
          const matchesData = await matchesRes.json();
          setUpcomingMatches(matchesData.slice(0, 3)); 
        }
      } catch (error) {
        console.error("Failed to load homepage data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHomepageData();
  }, []);

  const formatShortDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e17] transition-colors duration-300 font-sans">
      
      {/* --- PREMIUM HERO SECTION --- */}
      <header className="relative w-full h-[75vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&q=80" 
            alt="Stadium Background" 
            className="w-full h-full object-cover scale-105 animate-slow-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-[#0a0e17]/80 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-transparent to-transparent pointer-events-none" />
        </div>
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center">
          <div className="flex-1 text-left">
            <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md">
              <span className="text-blue-300 font-bold tracking-wider text-sm uppercase">Premier League 2025/2026</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-4 leading-tight">
              THE PITCH <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                IS YOURS.
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-xl mb-8 font-light">
              The ultimate hub for <u className="decoration-blue-500 decoration-4 underline-offset-4 font-bold text-white">Premier League</u> fanatics. Analyze matches, debate tactics, and follow your club with real-time AI insights.
            </p>
            <div className="flex flex-wrap gap-4 relative z-20">
              {isLoggedIn ? (
                <Link href="/dashboard" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-[0_0_30px_-5px_rgba(37,99,235,0.5)] transition-all hover:scale-105">
                  Your Daily Dashboard
                </Link>
              ) : (
                <Link href="/signup" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-[0_0_30px_-5px_rgba(37,99,235,0.5)] transition-all hover:scale-105">
                  Join the Club
                </Link>
              )}
              <Link href="/forums" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white backdrop-blur-lg rounded-2xl font-bold border border-white/10 transition-all">
                Enter Forums
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT GRID --- */}
      <main className="max-w-7xl mx-auto py-12 px-6 lg:px-8 relative z-20 -mt-20">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          <div className="lg:col-span-2 space-y-12">
            
            {/* --- LARGER VISUAL NAVIGATION SECTION --- */}
            <section className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">The Premier League Hub</h2>
              </div>
              
              <div className="flex flex-col gap-6">
                
                {/* 1. LARGE FEATURED VIDEO (Full Width) */}
                <div className="rounded-2xl overflow-hidden aspect-video bg-black shadow-lg border border-gray-200 dark:border-gray-800 relative group">
                  {!playVideo ? (
                    <div 
                      className="absolute inset-0 z-10 cursor-pointer"
                      onClick={() => setPlayVideo(true)}
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80" 
                        alt="Play Highlights"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 bg-blue-600/90 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                          <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 p-6 bg-gradient-to-t from-black to-transparent w-full text-left">
                        <p className="text-white text-xl font-bold">Watch Latest Highlights</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full overflow-hidden relative">
                      <iframe 
                        className="absolute top-[-10%] left-0 w-full h-[120%]"
                        src="https://www.youtube.com/embed/99bUS3QyKoY?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1" 
                        title="Premier League Video" 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen>
                      </iframe>
                    </div>
                  )}
                </div>

                {/* 6-CARD GRID FOR FULL SITE NAVIGATION */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  
                  {/* 1. Dashboard */}
                  <Link 
                    href={isLoggedIn ? "/dashboard" : "/signup"} 
                    className="group relative rounded-2xl overflow-hidden aspect-square md:aspect-video bg-[#0a0e17] block shadow-md border border-gray-200 dark:border-gray-800"
                  >
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Erling_Haaland_June_2025.jpg/960px-Erling_Haaland_June_2025.jpg" 
                      alt="Dashboard" 
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 opacity-70 group-hover:opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    
                    {/* Link Indicator Arrow */}
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md p-2 rounded-full border border-white/10 group-hover:bg-blue-600 transition-colors duration-300">
                      <svg className="w-3 h-3 text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>

                    <div className="absolute bottom-0 left-0 p-4 md:p-5 w-full">
                      <div className="flex items-center gap-1.5 mb-1 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        <span className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-widest">Your Hub</span>
                      </div>
                      <h3 className="text-white font-black text-lg md:text-xl leading-tight transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">Dashboard</h3>
                    </div>
                  </Link>

                  {/* 2. Forums */}
                  <Link href="/forums" className="group relative rounded-2xl overflow-hidden aspect-square md:aspect-video bg-[#0a0e17] block shadow-md border border-gray-200 dark:border-gray-800">
                    <img src="https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&q=80&w=200" alt="Forums" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-70 group-hover:opacity-90"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md p-2 rounded-full border border-white/10 group-hover:bg-blue-600 transition-colors duration-300">
                      <svg className="w-3 h-3 text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>

                    <div className="absolute bottom-0 left-0 p-4 md:p-5 w-full">
                      <div className="flex items-center gap-1.5 mb-1 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                        </svg>
                        <span className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-widest">Discussions</span>
                      </div>
                      <h3 className="text-white font-black text-lg md:text-xl leading-tight transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">Forums</h3>
                    </div>
                  </Link>

                  {/* 3. Teams */}
                  <Link href="/teams" className="group relative rounded-2xl overflow-hidden aspect-square md:aspect-video bg-[#0a0e17] block shadow-md border border-gray-200 dark:border-gray-800">
                    <img src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80" alt="Teams" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-70 group-hover:opacity-90"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md p-2 rounded-full border border-white/10 group-hover:bg-blue-600 transition-colors duration-300">
                      <svg className="w-3 h-3 text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>

                    <div className="absolute bottom-0 left-0 p-4 md:p-5 w-full">
                      <div className="flex items-center gap-1.5 mb-1 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-widest">Clubs</span>
                      </div>
                      <h3 className="text-white font-black text-lg md:text-xl leading-tight transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">All Teams</h3>
                    </div>
                  </Link>

                  {/* 4. Standings */}
                  <Link href="/standings" className="group relative rounded-2xl overflow-hidden aspect-square md:aspect-video bg-[#0a0e17] block shadow-md border border-gray-200 dark:border-gray-800">
                    <img src="https://images.unsplash.com/photo-1508344928928-7165b67de128?auto=format&fit=crop&q=80" alt="Standings" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-70 group-hover:opacity-90"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md p-2 rounded-full border border-white/10 group-hover:bg-blue-600 transition-colors duration-300">
                      <svg className="w-3 h-3 text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>

                    <div className="absolute bottom-0 left-0 p-4 md:p-5 w-full">
                      <div className="flex items-center gap-1.5 mb-1 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-widest">Rankings</span>
                      </div>
                      <h3 className="text-white font-black text-lg md:text-xl leading-tight transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">Standings</h3>
                    </div>
                  </Link>

                  {/* 5. Matches */}
                  <Link href="/matches" className="group relative rounded-2xl overflow-hidden aspect-square md:aspect-video bg-[#0a0e17] block shadow-md border border-gray-200 dark:border-gray-800">
                    <img src="https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80" alt="Matches" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-70 group-hover:opacity-90"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md p-2 rounded-full border border-white/10 group-hover:bg-blue-600 transition-colors duration-300">
                      <svg className="w-3 h-3 text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>

                    <div className="absolute bottom-0 left-0 p-4 md:p-5 w-full">
                      <div className="flex items-center gap-1.5 mb-1 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-widest">Calendar</span>
                      </div>
                      <h3 className="text-white font-black text-lg md:text-xl leading-tight transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">Matches</h3>
                    </div>
                  </Link>

                  {/* 6. Community / Search Users */}
                  <Link href="/search-users" className="group relative rounded-2xl overflow-hidden aspect-square md:aspect-video bg-[#0a0e17] block shadow-md border border-gray-200 dark:border-gray-800">
                    <img src="https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&q=80" alt="Community" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-70 group-hover:opacity-90"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md p-2 rounded-full border border-white/10 group-hover:bg-blue-600 transition-colors duration-300">
                      <svg className="w-3 h-3 text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>

                    <div className="absolute bottom-0 left-0 p-4 md:p-5 w-full">
                      <div className="flex items-center gap-1.5 mb-1 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-widest">Connect</span>
                      </div>
                      <h3 className="text-white font-black text-lg md:text-xl leading-tight transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">Search Users</h3>
                    </div>
                  </Link>

                </div>

              </div>
            </section>

            {/* --- MODERNIZED FEATURE SECTION --- */}
            <section>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-6 tracking-tight">Why ForumApp?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Feature 1 */}
                <Link href="/forums" className="group p-8 bg-white dark:bg-[#1f2937] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden block">
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:translate-x-1 group-hover:-translate-y-1">
                    <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                  <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 dark:border-blue-900/30">
                    <span className="text-3xl block">⚡</span>
                  </div>
                  <h3 className="font-bold text-2xl mb-3 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Live Match Threads</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">React to every goal, VAR decision, and red card as it happens with fans worldwide in real-time.</p>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Join the discussion <span aria-hidden="true">&rarr;</span>
                  </span>
                </Link>

                {/* Feature 2: AI Digest */}
                <Link 
                  href={isLoggedIn ? "/dashboard" : "/signup"} 
                  className="group p-8 bg-white dark:bg-[#1f2937] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden block"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:translate-x-1 group-hover:-translate-y-1">
                    <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-900/30">
                    <span className="text-3xl block">🤖</span>
                  </div>
                  <h3 className="font-bold text-2xl mb-3 text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">AI Digest</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">Our AI summaries let you quickly catch up on 100+ recent matches and 1,000+ posts and threads from the Premier League—so you never miss key insights!</p>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    {isLoggedIn ? "Go to your dashboard" : "Sign up to see AI in action"} <span aria-hidden="true">&rarr;</span>
                  </span>
                </Link>

              </div>
            </section>
          </div>

          <aside className="space-y-6">
            
            {/* --- LEAGUE TABLE PREVIEW --- */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">League Preview</h3>
              </div>
              <div className="p-4 space-y-4">
                {isLoading ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    ))}
                  </div>
                ) : topTeams.length > 0 ? (
                  topTeams.map((row) => (
                    <div key={row.position} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`font-mono font-bold w-4 text-center ${row.position <= 4 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                          {row.position}
                        </span>
                        <img 
                          src={row.team.crest || row.team.logoUrl || `https://ui-avatars.com/api/?name=${row.team.shortName || row.team.name}&background=random&color=fff&rounded=true&bold=true`} 
                          alt={row.team.name} 
                          className="w-5 h-5 object-contain"
                          loading="lazy"
                        />
                        <span className="font-semibold dark:text-white truncate max-w-[120px]" title={row.team.name}>
                          {row.team.shortName || row.team.name}
                        </span>
                      </div>
                      <div className="flex gap-4 font-mono text-xs">
                        <span className="text-gray-500" title="Played">{row.playedGames}</span>
                        <span className="font-extrabold text-gray-900 dark:text-white" title="Points">{row.points}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Standings unavailable.</p>
                )}
                
                <Link href="/standings" className="block text-center text-xs font-bold text-blue-500 uppercase tracking-widest pt-2 hover:text-blue-600 transition-colors">
                  Full Standings &rarr;
                </Link>
              </div>
            </div>
            
            {/* Real Upcoming Matches Preview */}
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group">
              
              {/* Header */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Next Matches
                </h3>
              </div>

              <div className="p-4 relative z-10">
                {isLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl"></div>
                    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl"></div>
                  </div>
                ) : upcomingMatches.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingMatches.map((match) => (
                      <Link 
                        href={`/matches`} 
                        key={match.id} 
                        className="block bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500/50 dark:hover:border-blue-500/50 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
                      >
                        {/* Date / Matchday Header */}
                        <div className="text-center mb-3">
                          <span className="inline-block px-3 py-1 bg-white dark:bg-[#111827] text-gray-600 dark:text-gray-400 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-sm border border-gray-100 dark:border-gray-700">
                            {formatShortDate(match.date)}
                          </span>
                        </div>

                        {/* Matchup Row */}
                        <div className="flex justify-between items-center gap-2">
                          
                          {/* Home Team */}
                          <div className="flex-1 flex flex-col items-center gap-2">
                            <img 
                              src={match.homeTeam.crest || match.homeTeam.logoUrl || `https://ui-avatars.com/api/?name=${match.homeTeam.shortName || match.homeTeam.name}&background=random&color=fff&rounded=true&bold=true`} 
                              alt={match.homeTeam.name} 
                              className="w-10 h-10 object-contain drop-shadow-sm"
                            />
                            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center line-clamp-1" title={match.homeTeam.name}>
                              {match.homeTeam.shortName || match.homeTeam.name}
                            </span>
                          </div>
                          
                          {/* VS Badge */}
                          <div className="px-2 flex flex-col items-center justify-center">
                            <span className="text-[10px] font-black italic text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 w-6 h-6 flex items-center justify-center rounded-full">VS</span>
                          </div>

                          {/* Away Team */}
                          <div className="flex-1 flex flex-col items-center gap-2">
                            <img 
                              src={match.awayTeam.crest || match.awayTeam.logoUrl || `https://ui-avatars.com/api/?name=${match.awayTeam.shortName || match.awayTeam.name}&background=random&color=fff&rounded=true&bold=true`} 
                              alt={match.awayTeam.name} 
                              className="w-10 h-10 object-contain drop-shadow-sm"
                            />
                            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center line-clamp-1" title={match.awayTeam.name}>
                              {match.awayTeam.shortName || match.awayTeam.name}
                            </span>
                          </div>

                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl text-center border border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No upcoming matches scheduled.</p>
                  </div>
                )}

                <Link href="/matches" className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/link">
                  All Fixtures 
                  <span className="transform group-hover/link:translate-x-1 transition-transform">&rarr;</span>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-gray-100 dark:border-gray-800 py-12 text-center text-gray-500 text-sm">
        <p>© 2026 ForumApp. Built for football lovers by Shunqi, Andrew, and Ronald.</p>
      </footer>
    </div>
  );
}