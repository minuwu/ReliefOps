import { useState } from 'react';
import { useVictimSessionStore } from '@/store/useVictimSessionStore';
import { api } from '@/services/api';
import { DEMO_BANKS } from '@/services/mockData';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CaseProgressStepper } from '@/components/cases/CaseProgressStepper';
import {
  Send,
  Building2,
  CheckCircle2,
  Quote,
  AlertCircle,
  KeyRound,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export function VictimPortalPage() {
  const { victimCase, chatThread, authenticate, sendMessage, isChatSending, clearSession } =
    useVictimSessionStore();

  const [activeTab, setActiveTab] = useState<'track' | 'intake'>('track');

  // Intake Form State
  const [bankId, setBankId] = useState('bank_b');
  const [victimName, setVictimName] = useState('');
  const [victimPhone, setVictimPhone] = useState('');
  const [victimEmail, setVictimEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName] = useState('');
  const [scamType, setScamType] = useState('impersonation');
  const [description, setDescription] = useState('');
  const [isSubmittingIntake, setIsSubmittingIntake] = useState(false);
  const [intakeSuccessResult, setIntakeSuccessResult] = useState<{ reference: string; access_code: string } | null>(null);

  // Victim Login State
  const [refInput, setRefInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Chat message state
  const [questionText, setQuestionText] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refInput || !codeInput) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await authenticate(refInput.trim(), codeInput.trim());
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickDemoFill = async (ref: string, code: string) => {
    setRefInput(ref);
    setCodeInput(code);
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await authenticate(ref.trim(), code.trim());
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    const q = questionText.trim();
    setQuestionText('');
    await sendMessage(q);
  };

  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!victimName || !amount || !accountNumber) return;
    setIsSubmittingIntake(true);
    try {
      const res = await api.submitIntake({
        bank_id: bankId,
        victim_name: victimName,
        victim_phone: victimPhone,
        victim_email: victimEmail,
        amount: Number(amount),
        currency: 'JPY',
        transfer_date: transferDate,
        account_number: accountNumber,
        account_holder_name: accountHolderName,
        scam_type: scamType,
        description,
      });
      setIntakeSuccessResult({
        reference: res.data.reference,
        access_code: res.data.access_code,
      });
    } finally {
      setIsSubmittingIntake(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 font-['Space_Grotesk',sans-serif]">
      {/* Top Banner */}
      <div className="p-4 sm:p-8 rounded-2xl border-2 border-[#09090B] bg-[#09090B] text-[#F8F4E8] shadow-hard sm:shadow-hard-lg flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern-inverted opacity-10 pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <StickerBadge variant="acid" rotate="-rotate-1" className="text-xs">
              CITIZEN SELF-SERVICE PORTAL
            </StickerBadge>
            <span className="text-[11px] sm:text-xs font-mono text-[#D2E823] font-bold uppercase">
              PROTECTED UNDER LAW NO. 133
            </span>
          </div>
          <GlitchText as="h1" className="text-xl sm:text-3xl font-['Dela_Gothic_One'] text-[#F8F4E8] break-words">
            FRAUD RELIEF & CITIZEN CLAIMS
          </GlitchText>
          <p className="text-xs text-[#A1A1AA] max-w-xl font-medium">
            Track your scam restitution claim, verify frozen mule funds, or consult our 24/7 Bluebook AI Assistant regarding pro-rata distribution rights.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 bg-[#18181B] p-1.5 rounded-xl border-2 border-[#27272A]">
          <button
            onClick={() => setActiveTab('track')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'track'
                ? 'bg-[#D2E823] text-[#09090B] shadow-[2px_2px_0px_0px_#F8F4E8]'
                : 'text-[#A1A1AA] hover:text-[#F8F4E8]'
              }`}
          >
            TRACK CASE
          </button>
          <button
            onClick={() => setActiveTab('intake')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'intake'
                ? 'bg-[#D2E823] text-[#09090B] shadow-[2px_2px_0px_0px_#F8F4E8]'
                : 'text-[#A1A1AA] hover:text-[#F8F4E8]'
              }`}
          >
            FILE REPORT
          </button>
        </div>
      </div>

      {/* ====================================================================
       * TAB 1: TRACK EXISTING CASE
       * ==================================================================== */}
      {activeTab === 'track' && (
        <>
          {!victimCase ? (
            /* Login Box */
            <div className="max-w-md mx-auto p-6 sm:p-8 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-lg space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-[#09090B] text-[#D2E823] flex items-center justify-center mx-auto border-2 border-[#09090B] shadow-hard-sm">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-['Dela_Gothic_One'] uppercase text-[#09090B]">
                  ACCESS YOUR CLAIM
                </h2>
                <p className="text-xs text-[#52525B] font-medium">
                  Enter your Case Reference ID and 12-character Access Code issued by your bank.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Case Reference *"
                  placeholder="e.g. RFR-2026-00042"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  required
                />
                <Input
                  label="One-Time Access Code *"
                  placeholder="e.g. K7QM-4XHP-2RTV"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  required
                />

                {loginError && (
                  <p className="text-xs text-[#FF334B] font-bold bg-[#FF334B]/10 p-3 rounded-xl border-2 border-[#FF334B]">
                    {loginError}
                  </p>
                )}

                <Button type="submit" variant="primary" size="lg" className="w-full gap-2 shadow-hard hover:shadow-hard-sm" isLoading={isLoggingIn}>
                  <span>AUTHENTICATE & TRACK CLAIM</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              {/* Demo Quick Fills for Judges */}
              <div className="pt-5 border-t-2 border-[#09090B] space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#52525B] text-center">
                  1-CLICK DEMO CREDENTIALS (JUDGES)
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleQuickDemoFill('RFR-2026-00042', 'K7QM-4XHP-2RTV')}
                    className="p-3 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] hover:bg-[#D2E823] transition-colors text-xs text-left flex justify-between items-center cursor-pointer shadow-hard-sm"
                  >
                    <div>
                      <strong className="font-mono text-[#09090B]">RFR-2026-00042</strong>
                      <span className="text-[10px] text-[#52525B] block">Bank of Tokyo • Verified</span>
                    </div>
                    <span className="text-xs font-bold text-[#09090B] uppercase">USE CODE →</span>
                  </button>
                  <button
                    onClick={() => handleQuickDemoFill('RFR-2026-00051', 'M3PX-8KWN-5QDA')}
                    className="p-3 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] hover:bg-[#D2E823] transition-colors text-xs text-left flex justify-between items-center cursor-pointer shadow-hard-sm"
                  >
                    <div>
                      <strong className="font-mono text-[#09090B]">RFR-2026-00051</strong>
                      <span className="text-[10px] text-[#52525B] block">Osaka Bank • Received</span>
                    </div>
                    <span className="text-xs font-bold text-[#09090B] uppercase">USE CODE →</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Logged-In Citizen Workspace */
            <div className="space-y-6">
              {/* Stepper Card */}
              <div className="p-6 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard">
                <CaseProgressStepper currentStatus={victimCase.status} closureReason={victimCase.closure_reason} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Case Facts & Verification (5 Cols) */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="p-6 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-4">
                    <div className="flex items-start justify-between border-b-2 border-[#09090B] pb-3">
                      <div>
                        <span className="font-mono text-xl font-black text-[#09090B]">
                          {victimCase.reference}
                        </span>
                        <p className="text-xs text-[#52525B] flex items-center gap-1 mt-0.5 font-bold uppercase">
                          <Building2 className="w-3.5 h-3.5 text-[#09090B]" />
                          {victimCase.bank_name}
                        </p>
                      </div>
                      <Badge status={victimCase.status}>
                        {victimCase.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs font-medium">
                      <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                        <span className="text-[#52525B]">Claimant:</span>
                        <span className="font-bold text-[#09090B] uppercase">{victimCase.victim.name}</span>
                      </div>
                      <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                        <span className="text-[#52525B]">Reported Loss:</span>
                        <span className="font-['Dela_Gothic_One'] text-sm text-[#09090B]">
                          {formatCurrency(victimCase.amount, victimCase.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                        <span className="text-[#52525B]">Transfer Date:</span>
                        <span className="font-mono text-[#09090B]">
                          {victimCase.transfer_date ? formatDate(victimCase.transfer_date) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                        <span className="text-[#52525B]">Suspect Account:</span>
                        <span className="font-mono font-bold text-[#FF334B]">{victimCase.account_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#52525B]">Report Date:</span>
                        <span className="font-mono text-[#09090B]">{formatDate(victimCase.submitted_at)}</span>
                      </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={clearSession} className="w-full text-xs shadow-hard-sm">
                      EXIT SESSION
                    </Button>
                  </div>
                </div>

                {/* Right Column: Case Assistant RAG Chatbot (7 Cols) */}
                <div className="lg:col-span-7">
                  <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard flex flex-col h-[580px] overflow-hidden">
                    {/* Chat Header */}
                    <div className="p-4 border-b-2 border-[#09090B] bg-[#EDE8D5] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-[#09090B] text-[#D2E823] flex items-center justify-center font-bold text-xs border border-[#09090B]">
                          <Sparkles className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="text-xs font-['Dela_Gothic_One'] uppercase text-[#09090B]">
                            BANK BLUEBOOK RESTITUTION ASSISTANT
                          </p>
                          <p className="text-[10px] font-mono text-[#52525B]">
                            RAG Grounded in {victimCase.bank_name} Statutory Policies
                          </p>
                        </div>
                      </div>
                      <StickerBadge variant="acid" rotate="rotate-0" className="text-[10px] py-0 px-2">
                        LAW 133 GROUNDED
                      </StickerBadge>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {chatThread?.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${msg.role === 'victim' ? 'items-end' : 'items-start'
                            }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-4 text-xs font-medium leading-relaxed border-2 border-[#09090B] ${msg.role === 'victim'
                                ? 'bg-[#09090B] text-[#D2E823] shadow-hard-sm rounded-br-none'
                                : 'bg-[#F8F4E8] text-[#09090B] shadow-hard-sm rounded-bl-none space-y-2'
                              }`}
                          >
                            <p>{msg.body}</p>

                            {/* Citations */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="pt-2 border-t-2 border-[#09090B]/20 space-y-1.5">
                                <p className="text-[10px] font-bold text-[#09090B] uppercase flex items-center gap-1">
                                  <Quote className="w-3 h-3" /> OFFICIAL CITATION:
                                </p>
                                {msg.citations.map((c, i) => (
                                  <div key={i} className="p-2 rounded-lg bg-[#EDE8D5] border border-[#09090B] text-[10px] space-y-0.5">
                                    <p className="font-bold text-[#09090B]">{c.document_title} (v{c.version})</p>
                                    <p className="text-[#52525B]">{c.section} • Page {c.page}</p>
                                    <p className="italic text-[#09090B] mt-1">"{c.quote}"</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {msg.needs_staff && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#09090B] bg-[#FF334B] p-2 rounded-lg border border-[#09090B]">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Escalation Triggered: Operations staff will review in queue.
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-[#52525B] mt-1 px-1">
                            {msg.role === 'victim' ? 'You' : 'Bluebook Assistant'} •{' '}
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Quick Starter Chips */}
                    <div className="px-3 py-2 bg-[#EDE8D5] border-t-2 border-[#09090B] flex flex-wrap gap-1.5">
                      {[
                        'What is the 30-day notice period?',
                        'How does pro-rata distribution work?',
                        'Will I recover 100% of my loss?',
                        'What if the mule account balance is zero?',
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => {
                            setQuestionText(prompt);
                            sendMessage(prompt);
                          }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg border-2 border-[#09090B] bg-[#F8F4E8] text-[#09090B] hover:bg-[#D2E823] transition-colors cursor-pointer shadow-hard-sm"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={handleSendChat} className="p-3 border-t-2 border-[#09090B] bg-[#EDE8D5] flex gap-2">
                      <input
                        type="text"
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Ask about pro-rata distribution, timeline, or required evidence..."
                        className="flex-1 text-xs font-bold rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3.5 py-2 shadow-hard-sm focus:outline-none placeholder:text-[#71717A]"
                      />
                      <Button type="submit" variant="primary" size="sm" isLoading={isChatSending} disabled={!questionText.trim()} className="shadow-hard-sm">
                        <Send className="w-3.5 h-3.5 mr-1" /> ASK
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ====================================================================
       * TAB 2: FILE NEW REPORT
       * ==================================================================== */}
      {activeTab === 'intake' && (
        <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-lg space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-['Dela_Gothic_One'] uppercase text-[#09090B]">
              PUBLIC CITIZEN CLAIM REGISTRATION
            </h2>
            <p className="text-xs text-[#52525B] font-medium">
              Submit an official scam report under Japan's Furikome Sagi Relief Act across any of the 5 partner regional banks.
            </p>
          </div>

          {intakeSuccessResult ? (
            <div className="p-6 rounded-2xl bg-[#D2E823] text-[#09090B] border-2 border-[#09090B] shadow-hard space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="font-['Dela_Gothic_One'] uppercase text-base">REPORT OFFICIALLY REGISTERED</h3>
              </div>
              <p className="text-xs font-medium">
                Your scam claim has been securely received by the Operations Center. Save your access code to track pro-rata distribution progress.
              </p>
              <div className="p-4 rounded-xl bg-[#F8F4E8] border-2 border-[#09090B] space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#52525B]">CASE REFERENCE:</span>
                  <span className="font-bold text-[#09090B]">{intakeSuccessResult.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#52525B]">ACCESS CODE:</span>
                  <span className="font-black text-[#09090B] tracking-widest text-sm">{intakeSuccessResult.access_code}</span>
                </div>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setIntakeSuccessResult(null);
                  setActiveTab('track');
                  setRefInput(intakeSuccessResult.reference);
                  setCodeInput(intakeSuccessResult.access_code);
                }}
                className="w-full shadow-hard"
              >
                PROCEED TO CASE TRACKER
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmitIntake} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
                    TARGET REGIONAL BANK
                  </label>
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="w-full text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3 shadow-hard-sm focus:outline-none"
                  >
                    {DEMO_BANKS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
                    SCAM CATEGORY
                  </label>
                  <select
                    value={scamType}
                    onChange={(e) => setScamType(e.target.value)}
                    className="w-full text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3 shadow-hard-sm focus:outline-none"
                  >
                    <option value="impersonation">Police / Financial Impersonation</option>
                    <option value="investment">Fraudulent Investment Solicitation</option>
                    <option value="romance">International Romance Fraud</option>
                    <option value="tech_support">Remote Desktop Extortion</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Your Full Name *"
                  value={victimName}
                  onChange={(e) => setVictimName(e.target.value)}
                  placeholder="e.g. Kenji Tanaka"
                  required
                />
                <Input
                  label="Phone Number"
                  value={victimPhone}
                  onChange={(e) => setVictimPhone(e.target.value)}
                  placeholder="+81 90-1234-5678"
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={victimEmail}
                  onChange={(e) => setVictimEmail(e.target.value)}
                  placeholder="victim@domain.jp"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Amount Lost (JPY) *"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1500000"
                  required
                />
                <Input
                  label="Transfer Date"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  required
                />
                <Input
                  label="Destination Account *"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 9823-1049-21"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
                  INCIDENT DETAILS / POLICE STATION REFERENCE
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the scam communication, wire transfer instructions, or police report filing number..."
                  className="w-full text-xs font-bold rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] p-3 shadow-hard-sm focus:outline-none placeholder:text-[#71717A]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t-2 border-[#09090B]">
                <Button variant="outline" size="md" type="button" onClick={() => setActiveTab('track')} className="shadow-hard-sm">
                  CANCEL
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isSubmittingIntake} className="gap-2 shadow-hard">
                  <span>SUBMIT STATUTORY REPORT</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
