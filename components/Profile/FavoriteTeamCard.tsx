export default function FavoriteTeamCard({ team }: { team: { id: number, name: string } | null }) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
          Favorite Team
        </h2>
        {team ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl shadow-inner">
              ⚽
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {team.name}
              </h3>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No favorite team selected.</p>
        )}
      </div>
    );
  }