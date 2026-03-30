'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import InputField from "@/components/Auth/InputField";
import { useTheme, AVAILABLE_AVATARS } from "@/contexts/ThemeContext";

export default function EditProfilePage() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    // CHANGED: Now using a number instead of a string
    avatarId: 0, 
    favoriteTeamId: '',
  });

  const [teams, setTeams] = useState<{ id: number, name: string }[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); 

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
    } else {
      setIsCheckingAuth(false);
    }
  }, [router]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch('/api/teams');
        if (res.ok) {
          const data = await res.json();
          setTeams(data.teams || data);
        }
      } catch (error) {
        console.error("Failed to fetch teams", error);
      }
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage({ text: '', type: '' });
  };

  const handleTeamSelect = (teamId: string) => {
    setFormData({ ...formData, favoriteTeamId: teamId });
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const updateData: any = {};
    if (formData.username) updateData.username = formData.username;
    if (formData.email) updateData.email = formData.email;
    if (formData.password) updateData.password = formData.password;
    
    // CHANGED: Appending the number to the payload
    if (formData.avatarId !== undefined) updateData.avatarId = formData.avatarId;
    
    if (formData.favoriteTeamId) updateData.favoriteTeamId = parseInt(formData.favoriteTeamId);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/users/edit', { 
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      
      // Reset form
      setFormData({ username: '', email: '', password: '', avatarId: 0, favoriteTeamId: '' });
      
      setTimeout(() => {
        window.location.reload();
      }, 800);

    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const selectedTeamName = teams.find(t => t.id.toString() === formData.favoriteTeamId)?.name || '-- Select a Team --';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">Edit Profile</h2>
        
        <form className="space-y-4" onSubmit={handleSubmit}>
          {message.text && (
            <div className={`p-3 rounded-xl border-l-4 text-sm font-bold ${message.type === 'success' ? 'bg-green-100 text-green-700 border-green-500' : 'bg-red-100 text-red-700 border-red-500'}`}>
              {message.text}
            </div>
          )}

          <InputField id="username" label="New Username" type="text" value={formData.username} onChange={handleChange} />
          <InputField id="email" label="New Email" type="email" value={formData.email} onChange={handleChange} />
          
          <div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">New Password</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 pr-10 border rounded-xl dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {/* SVG code unchanged */}
              </button>
            </div>
          </div>
          
          <div className="relative" ref={dropdownRef}>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">Favorite Team</label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full px-4 py-2 text-left rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white flex justify-between items-center"
            >
              {selectedTeamName}
              <span>{isDropdownOpen ? '▲' : '▼'}</span>
            </button>

            {isDropdownOpen && (
              <div className="absolute w-full mt-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto">
                {teams.map(team => (
                  <div 
                    key={team.id} 
                    onClick={() => handleTeamSelect(team.id.toString())}
                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer dark:text-white"
                  >
                    {team.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">Choose Avatar</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {/* CHANGED: We now map through using the `index` to set the avatarId */}
              {AVAILABLE_AVATARS.map((url, index) => (
                <div 
                  key={index}
                  onClick={() => setFormData({ ...formData, avatarId: index })}
                  className={`relative aspect-square rounded-full overflow-hidden cursor-pointer transition-all duration-200 ${
                    formData.avatarId === index 
                    ? 'ring-4 ring-blue-500 scale-105 shadow-md' 
                    : 'hover:scale-105 opacity-60 hover:opacity-100 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <img src={url} alt={`Avatar option ${index + 1}`} className="w-full h-full object-cover" />
                  {formData.avatarId === index && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 mt-6"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}