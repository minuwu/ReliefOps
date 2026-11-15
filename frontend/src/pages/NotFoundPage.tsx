import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { homeFor } from '@/routes/paths';

export function NotFoundPage() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
      <p className="font-['Dela_Gothic_One'] text-6xl text-[#09090B]">404</p>
      <h1 className="font-['Dela_Gothic_One'] text-2xl uppercase text-[#09090B]">Page not found</h1>
      <p className="text-sm font-medium text-[#52525B]">
        This address does not exist, or you do not have access to it.
      </p>
      <Link
        to={homeFor(user?.role)}
        className="inline-flex items-center px-5 py-2.5 rounded-xl border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard-sm text-sm font-bold uppercase hover:bg-[#09090B] hover:text-[#D2E823]"
      >
        Go to my home page
      </Link>
    </div>
  );
}
