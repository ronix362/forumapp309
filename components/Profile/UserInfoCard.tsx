// Inside @/components/Profile/UserInfoCard.tsx
export default function UserInfoCard({ user, stats }: any) {
  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors">
      <div className="flex flex-col items-center text-center">
        {/* Profile Avatar replaces the old (1) or Initial icon */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-blue-50 dark:border-blue-900/30 mb-4 shadow-sm">
          <img 
            src={user.avatarUrl} 
            alt={user.username} 
            className="w-full h-full object-cover"
          />
        </div>
        
        <h2 className="text-xl font-black text-gray-900 dark:text-white">@{user.username}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{user.email}</p>
        
        {/* ... (Followers/Following stats display) ... */}
      </div>
    </div>
  );
}