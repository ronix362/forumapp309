import SignupForm from "@/components/Auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md border dark:border-gray-700">
        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-8">
          Create Account
        </h2>
        
        {/* We just drop the component in here */}
        <SignupForm />

        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account? <a href="/login" className="text-blue-600 dark:text-blue-400 font-semibold">Log in</a>
        </p>
      </div>
    </div>
  );
}