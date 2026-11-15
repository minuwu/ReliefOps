import { Link } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import { DataModeSwitch } from './DataModeSwitch';

export function Footer() {
  return (
    <footer className="w-full bg-[#F8F4E8] border-t border-[#09090B] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#52525B]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#09090B]">ReliefOps</span>
          <span>·</span>
          <span>Fraud relief operations for partner banks.</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <DataModeSwitch />
          <Link to={PATHS.portalReport} className="hover:text-[#09090B] transition-colors">
            Report a scam
          </Link>
          <Link to={PATHS.login} className="hover:text-[#09090B] transition-colors">
            Staff login
          </Link>
        </div>
      </div>
    </footer>
  );
}
