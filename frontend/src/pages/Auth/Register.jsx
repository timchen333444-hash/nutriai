import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';

function friendlyRegisterError(msg) {
  if (!msg) return 'Something went wrong. Please try again.';
  if (msg.toLowerCase().includes('already'))
    return 'That email is already registered. Try signing in instead.';
  return msg;
}

export default function Register() {
  const [form,    setForm]    = useState({ name: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login }    = useAuth();
  const toast        = useToast();
  const navigate     = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Your password needs to be at least 6 characters long.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/register', form);
      login(data.token, data.user);
      navigate('/onboarding');
    } catch (err) {
      toast.error(friendlyRegisterError(err.response?.data?.error));
    } finally {
      setLoading(false);
    }
  };

  const field = 'w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-base bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors placeholder:text-gray-400';
  const label = 'block text-base font-semibold text-gray-700 mb-2';

  return (
    <div className="min-h-screen bg-primary-light flex flex-col px-6 py-12">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-sm">
          <Leaf size={24} className="text-white" />
        </div>
        <span className="font-syne font-bold text-2xl text-primary-dark">NutriAI</span>
      </div>

      <h1 className="font-syne font-bold text-3xl text-gray-900 mb-2">Create your account</h1>
      <p className="text-base text-gray-500 mb-8">Personalised nutrition powered by AI</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="name" className={label}>Your name</label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            className={field}
            placeholder="Alex Smith"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="email" className={label}>Email address</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className={field}
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="password" className={label}>Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPwd ? 'text' : 'password'}
              required
              autoComplete="new-password"
              className={`${field} pr-14`}
              placeholder="At least 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
              onClick={() => setShowPwd(!showPwd)}
            >
              {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-1.5 ml-1">Minimum 6 characters</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[52px] bg-primary text-white text-base font-bold rounded-2xl mt-2 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/30"
        >
          {loading ? <><Loader2 size={20} className="animate-spin" />Creating account…</> : 'Get started — it\'s free'}
        </button>
      </form>

      <p className="text-center text-base text-gray-500 mt-8">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
