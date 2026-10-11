import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Lock, Mail, Loader2, Shield, Briefcase, Wallet, CheckSquare } from 'lucide-react';

const demoAccounts = [
  { email: 'admin@asha.org', password: 'Admin@123', label: 'Admin', desc: 'Full access', icon: Shield },
  { email: 'manager@asha.org', password: 'Manager@123', label: 'Project Manager', desc: 'Projects, budgets, funding', icon: Briefcase },
  { email: 'finance@asha.org', password: 'Finance@123', label: 'Finance Officer', desc: 'Expenses, evidence', icon: Wallet },
  { email: 'reviewer@asha.org', password: 'Reviewer@123', label: 'Reviewer', desc: 'Approve / reject', icon: CheckSquare },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) setError(signInError);
    setSubmitting(false);
  }

  function quickFill(acc: { email: string; password: string }) {
    setEmail(acc.email);
    setPassword(acc.password);
    setError(null);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left — solid dark teal-green panel */}
      <div className="lg:w-1/2 relative min-h-[40vh] lg:min-h-screen flex flex-col justify-between p-8 lg:p-14 overflow-hidden bg-gradient-to-br from-[#0d4f4f] via-[#115e63] to-[#0a3f3f]">

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg">
            I
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-tight">Impact Ledger</p>
            <p className="text-teal-300/80 text-sm">Funding &amp; Expense Tracking</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
            Know what was funded. Track what was spent. See what was delivered.
          </h1>
        </div>

        {/* Footer line */}
        <div className="relative z-10 text-teal-200/70 text-sm">
          Every transaction. Every decision. Every receipt — in one ledger.
        </div>
      </div>

      {/* Right — floating sign-in card */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-10 bg-gradient-to-br from-teal-50/60 to-white">
        <div className="w-full max-w-md bg-white rounded-2xl border border-stone-100 shadow-2xl shadow-teal-900/8 p-7 sm:p-9">
          <h2 className="text-2xl font-bold text-stone-800 mb-1">Sign in</h2>
          <p className="text-stone-500 mb-7 text-sm">Enter your credentials to access Impact Ledger.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@impactledger.org"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl text-white font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-teal"
            >
              {submitting && <Loader2 size={18} className="animate-spin" />}
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-7">
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">
              Demo accounts — click to fill
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {demoAccounts.map((acc) => {
                const Icon = acc.icon;
                return (
                  <button
                    key={acc.email}
                    onClick={() => quickFill(acc)}
                    className="text-left px-3.5 py-3 rounded-xl border border-stone-150 hover:border-teal-400 hover:bg-teal-50/60 transition group"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon size={15} className="text-teal-600 group-hover:text-teal-700" />
                      <p className="text-sm font-medium text-stone-700 group-hover:text-teal-800">{acc.label}</p>
                    </div>
                    <p className="text-xs text-stone-400 pl-5">{acc.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
