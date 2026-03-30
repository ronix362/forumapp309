'use client';

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTheme, AVAILABLE_AVATARS } from "@/contexts/ThemeContext";

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const NAV_LINKS = [
  { name: "🏠 Home", path: "/" },
  { name: "💬 Forums", path: "/forums" },
  { name: "🛡️ Teams", path: "/teams" },
  { name: "📈 Standings", path: "/standings" },
  { name: "⚽ Matches", path: "/matches" },
  { name: "🔍 Search Users", path: "/search-users" },
];

export default function Navbar() {
  const { darkMode, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname(); 
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<number>(0);
  const [isBanned, setIsBanned] = useState(false); 
  const [isAdmin, setIsAdmin] = useState(false);

  const [logoDropdownOpen, setLogoDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  
  const logoDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.id) {
        setIsLoggedIn(true);
        setCurrentUserId(decoded.id);
        setIsAdmin(decoded.role === "ADMIN");
        const name = decoded.username || decoded.name || decoded.displayName || decoded.email?.split('@')[0];
        setCurrentUserName(name || "User");

        fetch(`/api/users/${decoded.id}/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          setIsBanned(data?.user?.banned === true);
          if (data?.user?.avatarId !== undefined) setAvatarId(data.user.avatarId);
        })
        .catch(err => console.error("Profile check failed:", err));
      }
    } else {
      setIsLoggedIn(false);
      setCurrentUserId(null);
      setCurrentUserName(null);
      setIsBanned(false);
      setAvatarId(0);
      setIsAdmin(false);
    }
    setLogoDropdownOpen(false);
    setProfileDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (logoDropdownRef.current && !logoDropdownRef.current.contains(event.target as Node)) {
        setLogoDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        await fetch('/api/users/logout', { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${refreshToken}` }
        });
      } catch (error) { console.error(error); }
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setIsLoggedIn(false);
    setIsAdmin(false);
    router.push("/login");
  };

  const dynamicLinks = isLoggedIn 
    ? [NAV_LINKS[0], { name: "📊 Dashboard", path: "/dashboard" }, ...NAV_LINKS.slice(1)]
    : NAV_LINKS;

  return (
    <div className={`sticky top-0 z-50 flex flex-col w-full transition-all duration-300 ${
      scrolled 
        ? "bg-white/90 dark:bg-[#111827]/90 backdrop-blur-lg shadow-sm border-b border-gray-200 dark:border-gray-800" 
        : "bg-white dark:bg-[#111827] border-b border-transparent"
    }`}>
      
      {isBanned && (
        <div className="w-full bg-red-600 text-white text-sm font-bold py-2 px-6 flex justify-center items-center gap-4">
          <span>⚠️ Account Suspended.</span>
          <Link href="/appeal" className="bg-white text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase hover:bg-red-50 transition-colors">Appeal</Link>
        </div>
      )}

      <nav className="flex items-center justify-between py-3 px-6 lg:px-10 max-w-[1600px] mx-auto w-full">
        
        {/* Left: Logo Dropdown */}
        <div className="flex items-center gap-6">
          <div className="relative" ref={logoDropdownRef}>
            <button 
              onClick={() => setLogoDropdownOpen(!logoDropdownOpen)}
              className="font-extrabold text-2xl tracking-tighter flex items-center gap-2 group outline-none"
            >
              <div className="flex items-center">
                <span className="text-blue-600 dark:text-blue-500">FORUM</span>
                <span className="text-gray-900 dark:text-white">APP</span>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${logoDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {logoDropdownOpen && (
              <div className="absolute left-0 mt-4 w-64 bg-white dark:bg-[#1f2937] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 mb-1"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Site Explorer</p></div>
                {dynamicLinks.map((link) => {
                  const isForums = link.path === "/forums";
                  const isActive = pathname === link.path;

                  if (!isForums) {
                    return (
                      <Link
                        key={link.name}
                        href={link.path}
                        className={`flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        {link.name}
                      </Link>
                    );
                  }

                  return (
                    <div key={link.name} className="relative group">
                      <Link
                        href={link.path}
                        className={`flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        {link.name}
                      </Link>
                      <div className="absolute left-full top-0 ml-2 w-48 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1f2937] shadow-2xl py-2 opacity-0 invisible translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-x-0">
                        <Link href="/forums/general" className="block rounded-2xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                          General
                        </Link>
                        <Link href="/forums/match" className="block rounded-2xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                          Match
                        </Link>
                        <Link href="/forums/team" className="block rounded-2xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                          Team
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center: Desktop Nav Bar */}
        <div className="hidden xl:flex items-center gap-1">
          {dynamicLinks.map((link) => {
             const cleanName = link.name.split(' ').slice(1).join(' ');
             const isActive = pathname === link.path;
             return (
               <Link key={link.name} href={link.path} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${isActive ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                 {cleanName || "Home"}
               </Link>
             )
          })}
        </div>

        {/* Right: Theme & Profile Dropdown */}
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:scale-105 transition-all shadow-sm">
            {darkMode ? "☀️" : "🌙"}
          </button>

          {isLoggedIn ? (
            <div className="relative" ref={profileDropdownRef}>
              <div className="relative inline-block">
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)} 
                  className={`w-10 h-10 rounded-full border-2 transition-all overflow-hidden shadow-sm ${
                    isAdmin ? 'border-purple-500 hover:border-purple-400' : 'border-transparent hover:border-blue-500'
                  }`}
                >
                  <img src={AVAILABLE_AVATARS[avatarId] || `https://ui-avatars.com/api/?name=${currentUserName}`} className="w-full h-full object-cover" alt="Profile" />
                </button>
                
                {/* Admin Badge on the Avatar */}
                {isAdmin && (
                  <div className="absolute -bottom-1 -right-2 bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-white dark:border-[#111827] shadow-sm pointer-events-none z-10">
                    ADMIN
                  </div>
                )}
              </div>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-4 w-60 bg-white dark:bg-[#1f2937] rounded-2xl shadow-2xl py-2 border border-gray-100 dark:border-gray-700 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  
                  {/* Dynamic Header based on Role */}
                  <div className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 mb-2 ${
                    isAdmin ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50/50 dark:bg-gray-800/30'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold dark:text-white truncate">@{currentUserName}</p>
                      {isAdmin && (
                        <span className="text-[9px] bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200 px-2 py-0.5 rounded-full font-black tracking-widest">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter mt-1">Member Settings</p>
                  </div>
                  
                  <Link href={`/profile/${currentUserId}`} className="block px-4 py-2 text-sm font-medium dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">👤 My Profile</Link>
                  <Link href={`/profile/${currentUserId}/follow`} className="block px-4 py-2 text-sm font-medium dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">👥 Network</Link>
                  <Link href="/profile/edit" className="block px-4 py-2 text-sm font-medium dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">⚙️ Edit Profile</Link>
                  
                  {isAdmin && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <p className="px-4 text-[10px] text-purple-500 font-bold uppercase tracking-widest mb-1">Admin Panel</p>
                      <Link href="/admin/reports" className="block px-4 py-2 text-sm font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors">📝 Review Reports</Link>
                      <Link href="/admin/appeals" className="block px-4 py-2 text-sm font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors">🛡️ Review Appeals</Link>
                    </div>
                  )}

                  <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2"></div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-1 transition-colors">🚪 Log Out</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">Log In</Link>
              <Link href="/signup" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all">Sign Up</Link>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}