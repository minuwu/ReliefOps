import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { ShieldAlert, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 4000);
      setEmail('');
    }
  };

  return (
    <footer className="w-full bg-[#09090B] text-[#F8F4E8] border-t-4 border-[#09090B] mt-12 sm:mt-16 font-['Space_Grotesk',sans-serif]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          {/* Brand & Mission Statement (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#D2E823] text-[#09090B] flex items-center justify-center border-2 border-[#D2E823] shadow-[2px_2px_0px_0px_#F8F4E8]">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <GlitchText as="h2" className="text-2xl font-['Dela_Gothic_One'] text-[#F8F4E8]">
                RELIEFOPS
              </GlitchText>
            </div>
            <p className="text-sm text-[#A1A1AA] leading-relaxed max-w-sm">
              The unified statutory relief clearinghouse coordinating cross-bank fraud freezes, victim restitution claims, and pro-rata distributions under the Japanese Furikome Sagi Relief Act.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <StickerBadge variant="acid" rotate="rotate-1" className="text-xs">
                LAW NO. 133 OF 2007
              </StickerBadge>
              <span className="text-xs font-mono text-[#A1A1AA]">SEC-AUDIT V0.4.1</span>
            </div>
          </div>

          {/* Column 1: Operations (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#D2E823]">OPERATIONS</p>
            <ul className="space-y-2 text-xs uppercase tracking-wider font-bold">
              <li>
                <a href="#roster" className="text-[#F8F4E8] hover:text-[#D2E823] flex items-center gap-1 transition-colors">
                  Case Roster <ArrowUpRight className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="#triage" className="text-[#F8F4E8] hover:text-[#D2E823] flex items-center gap-1 transition-colors">
                  HITL AI OCR <ArrowUpRight className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="#syndicate" className="text-[#F8F4E8] hover:text-[#D2E823] flex items-center gap-1 transition-colors">
                  Syndicate Graph <ArrowUpRight className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="#audit" className="text-[#F8F4E8] hover:text-[#D2E823] flex items-center gap-1 transition-colors">
                  Audit Hash Log <ArrowUpRight className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Partner Banks (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#D2E823]">5-BANK CONSORTIUM</p>
            <ul className="space-y-2 text-xs uppercase tracking-wider font-bold">
              <li className="text-[#A1A1AA] hover:text-[#F8F4E8] transition-colors">BANK A (TOKYO)</li>
              <li className="text-[#A1A1AA] hover:text-[#F8F4E8] transition-colors">BANK B (OSAKA)</li>
              <li className="text-[#A1A1AA] hover:text-[#F8F4E8] transition-colors">BANK C (NAGOYA)</li>
              <li className="text-[#A1A1AA] hover:text-[#F8F4E8] transition-colors">BANK D (FUKUOKA)</li>
              <li className="text-[#A1A1AA] hover:text-[#F8F4E8] transition-colors">BANK E (SAPPORO)</li>
            </ul>
          </div>

          {/* Column 3: Emergency Dispatch Alerts (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#D2E823]">INCIDENT DISPATCH</p>
            <p className="text-xs text-[#A1A1AA]">
              Subscribe operational nodes to high-velocity mule account freeze broadcasts.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="flex gap-1.5">
                <input
                  type="email"
                  required
                  placeholder="operator@bank-alliance.jp"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border-2 border-[#F8F4E8] bg-transparent text-[#F8F4E8] placeholder:text-[#71717A] focus:outline-none focus:border-[#D2E823]"
                />
                <Button variant="secondary" size="sm" type="submit" className="shrink-0 shadow-none border-2 border-[#D2E823]">
                  CONNECT
                </Button>
              </div>
              {subscribed && (
                <p className="text-[11px] font-bold text-[#D2E823] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Dispatch frequency registered.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t-2 border-[#27272A] mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#71717A]">
          <p>© 2026 INTER-BANK RELIEF OPERATIONS CONSORTIUM. BUILT FOR HACKATHON 1.</p>
          <div className="flex items-center gap-6">
            <span>ZERO DATA RESIDENCY LEAKS</span>
            <span>AIR-GAPPED AUDIT LEDGER</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
