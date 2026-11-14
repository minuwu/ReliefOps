import { useState } from 'react';
import { useVictimSessionStore } from '@/store/useVictimSessionStore';
import { api } from '@/services/api';
import { DEMO_BANKS } from '@/services/mockData';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FileSpreadsheet,
  Send,
  Building2,
  CheckCircle2,
  Quote,
  AlertCircle,
  KeyRound,
  Sparkles,
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
  const [accountHolderName, setAccountHolderName] = useState('');
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

  const handleQuickDemoFill = (ref: string, code: string) => {
    setRefInput(ref);
    setCodeInput(code);
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-linear-to-r from-teal-900 to-slate-900 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-teal-500/30 text-teal-300 font-semibold text-xs border border-teal-400/30">
              Public Victim Protection Portal
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Fraud Victim Relief & Bluebook Assistant
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Submit a relief claim across any of the 5 participating regional banks, check your case status, or ask our Bluebook AI Assistant regarding restitution policies.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveTab('track')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'track' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            Track Existing Case
          </button>
          <button
            onClick={() => setActiveTab('intake')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'intake' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            File New Report
          </button>
        </div>
      </div>

      {/* ====================================================================
       * TAB 1: TRACK EXISTING CASE & ASK RAG CHATBOT
       * ==================================================================== */}
      {activeTab === 'track' && (
        <>
          {!victimCase ? (
            /* Login Box */
            <Card className="max-w-md mx-auto p-6 space-y-5">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Access Your Relief Case</h2>
                <p className="text-xs text-muted-foreground">
                  Enter the Reference ID and 12-character Access Code provided upon intake.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Case Reference"
                  placeholder="e.g. RFR-2026-00042"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  required
                />
                <Input
                  label="One-Time Access Code"
                  placeholder="e.g. K7QM-4XHP-2RTV"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  required
                />

                {loginError && (
                  <p className="text-xs text-destructive font-medium bg-destructive/10 p-2.5 rounded border border-destructive/20">
                    {loginError}
                  </p>
                )}

                <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white" isLoading={isLoggingIn}>
                  Verify & Open Case
                </Button>
              </form>

              {/* Demo Quick Fills */}
              <div className="pt-4 border-t border-border space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase text-center">
                  Judge Demo One-Click Access
                </p>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleQuickDemoFill('RFR-2026-00042', 'K7QM-4XHP-2RTV')}
                    className="p-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs text-left flex justify-between items-center cursor-pointer"
                  >
                    <span>
                      <strong>RFR-2026-00042</strong> (Birch Bank • Verified)
                    </span>
                    <span className="text-[10px] text-teal-600 font-mono">Use Code →</span>
                  </button>
                  <button
                    onClick={() => handleQuickDemoFill('RFR-2026-00051', 'M3PX-8KWN-5QDA')}
                    className="p-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs text-left flex justify-between items-center cursor-pointer"
                  >
                    <span>
                      <strong>RFR-2026-00051</strong> (Cobalt Bank • Received)
                    </span>
                    <span className="text-[10px] text-teal-600 font-mono">Use Code →</span>
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            /* Logged-In Victim Workspace */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Case Summary & Facts */}
              <div className="lg:col-span-5 space-y-5">
                <Card className="p-5 space-y-4">
                  <div className="flex items-start justify-between border-b border-border pb-3">
                    <div>
                      <span className="font-mono text-lg font-bold text-foreground">
                        {victimCase.reference}
                      </span>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-teal-600" />
                        {victimCase.bank_name}
                      </p>
                    </div>
                    <Badge status={victimCase.status}>
                      {victimCase.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-border/50 pb-1.5">
                      <span className="text-muted-foreground">Victim:</span>
                      <span className="font-semibold text-foreground">{victimCase.victim.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1.5">
                      <span className="text-muted-foreground">Reported Amount:</span>
                      <span className="font-mono font-bold text-foreground">
                        {formatCurrency(victimCase.amount, victimCase.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1.5">
                      <span className="text-muted-foreground">Incident Date:</span>
                      <span className="text-foreground">
                        {victimCase.transfer_date ? formatDate(victimCase.transfer_date) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1.5">
                      <span className="text-muted-foreground">Suspect Account:</span>
                      <span className="font-mono text-foreground">{victimCase.account_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reported Date:</span>
                      <span className="text-foreground">{formatDate(victimCase.submitted_at)}</span>
                    </div>
                  </div>

                  {/* Privacy Safe Note */}
                  <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground leading-relaxed">
                    <strong>Victim Privacy Protection (D13):</strong> Internal staff notes, investigator identity, and other case files are strictly quarantined from victim sessions.
                  </div>

                  <Button variant="outline" size="sm" onClick={clearSession} className="w-full text-xs">
                    Exit Case Session
                  </Button>
                </Card>
              </div>

              {/* Right Column: Case Assistant RAG Chatbot */}
              <div className="lg:col-span-7">
                <Card className="flex flex-col h-[560px]">
                  {/* Chat Header */}
                  <CardHeader className="py-3 px-5 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          Bank Bluebook Case Assistant
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                            RAG Grounded
                          </span>
                        </CardTitle>
                        <p className="text-[11px] text-muted-foreground">
                          Grounded strictly in <strong>{victimCase.bank_name}</strong>'s published policies
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Chat Messages Scroller */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {chatThread?.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          msg.role === 'victim' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                            msg.role === 'victim'
                              ? 'bg-teal-600 text-white rounded-br-none'
                              : 'bg-muted border border-border text-foreground rounded-bl-none space-y-2'
                          }`}
                        >
                          <p>{msg.body}</p>

                          {/* Grounded Bluebook Citations */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="pt-2 border-t border-border/60 space-y-1">
                              <p className="text-[10px] font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1 uppercase tracking-wider">
                                <Quote className="w-3 h-3" />
                                Official Policy Citation:
                              </p>
                              {msg.citations.map((c, i) => (
                                <div key={i} className="p-2 rounded bg-background/60 border border-border/60 text-[11px] space-y-0.5">
                                  <p className="font-semibold text-foreground">{c.document_title} (v{c.version})</p>
                                  <p className="text-muted-foreground">{c.section} • Page {c.page}</p>
                                  <p className="italic text-foreground/80 mt-1">"{c.quote}"</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Escalated flag */}
                          {msg.needs_staff && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Staff Escalation Triggered — Operations team will review in case thread.
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 px-1">
                          {msg.role === 'victim' ? 'You' : 'Assistant'} •{' '}
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Question Input */}
                  <form onSubmit={handleSendChat} className="p-3 border-t border-border bg-card flex gap-2">
                    <input
                      type="text"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder={`Ask about restitution, freezing rules, or deadlines for ${victimCase.bank_name}...`}
                      className="flex-1 text-xs bg-background border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      isLoading={isChatSending}
                      disabled={!questionText.trim()}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-3"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {/* ====================================================================
       * TAB 2: PUBLIC INTAKE FORM (SUBMIT FRAUD REPORT)
       * ==================================================================== */}
      {activeTab === 'intake' && (
        <Card className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="border-b border-border pb-4 space-y-1">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
              Submit Incident Report (Public Intake)
            </h2>
            <p className="text-xs text-muted-foreground">
              Register fraudulent wire transfer details directly into the operations relief network.
            </p>
          </div>

          {intakeSuccessResult ? (
            <div className="p-6 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-teal-950 dark:text-teal-200">
                  Incident Report Filed Successfully
                </h3>
                <p className="text-xs text-teal-800 dark:text-teal-300 mt-1">
                  Save your Case Reference and Access Code immediately. You will need both to track case progress and speak with the AI assistant.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
                <div className="p-3 bg-card rounded-lg border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Reference ID</p>
                  <p className="text-sm font-mono font-bold text-foreground mt-0.5">
                    {intakeSuccessResult.reference}
                  </p>
                </div>
                <div className="p-3 bg-card rounded-lg border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Access Code</p>
                  <p className="text-sm font-mono font-bold text-foreground mt-0.5">
                    {intakeSuccessResult.access_code}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => {
                  handleQuickDemoFill(intakeSuccessResult.reference, intakeSuccessResult.access_code);
                  setActiveTab('track');
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Track Case Now
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmitIntake} className="space-y-4">
              {/* Select Bank */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Destination Bank (Account Held At):</label>
                <select
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  className="w-full text-xs bg-background border border-input rounded-md p-2 focus:ring-1 focus:ring-teal-500"
                >
                  {DEMO_BANKS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Victim Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Your Full Name"
                  placeholder="e.g. Kenji Sato"
                  value={victimName}
                  onChange={(e) => setVictimName(e.target.value)}
                  required
                />
                <Input
                  label="Phone Number"
                  placeholder="e.g. 090-0000-1122"
                  value={victimPhone}
                  onChange={(e) => setVictimPhone(e.target.value)}
                />
                <Input
                  label="Email Address"
                  placeholder="e.g. sato@example.jp"
                  value={victimEmail}
                  onChange={(e) => setVictimEmail(e.target.value)}
                />
              </div>

              {/* Financial Facts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Amount Sent (JPY)"
                  type="number"
                  placeholder="e.g. 1500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <Input
                  label="Transfer Date"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  required
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Scam Type:</label>
                  <select
                    value={scamType}
                    onChange={(e) => setScamType(e.target.value)}
                    className="w-full text-xs bg-background border border-input rounded-md p-2 focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="phishing">Phishing</option>
                    <option value="impersonation">Impersonation / Police Escrow</option>
                    <option value="investment">Investment / Crypto Yield</option>
                    <option value="romance">Romance Scam</option>
                    <option value="lottery_prize">Lottery / Advance Fee</option>
                    <option value="job_offer">Fake Employment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Recipient Account Facts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Beneficiary Account Number"
                  placeholder="e.g. 9876543210"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
                <Input
                  label="Beneficiary Account Name"
                  placeholder="e.g. GLOBAL ASSET TRUST"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                />
              </div>

              {/* Narrative Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Incident Description:</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe how the fraudulent contact occurred and where you were instructed to send money..."
                  className="w-full text-xs bg-background border border-input rounded-md p-2.5 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                isLoading={isSubmittingIntake}
              >
                Submit Incident Report & Generate Case ID
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
