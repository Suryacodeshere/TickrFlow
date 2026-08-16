'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Ticket, Mail, Lock, User, ShieldCheck, X } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ATTENDEE' | 'ORGANIZER'>('ATTENDEE');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Google Login states
  const [showGoogleMock, setShowGoogleMock] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);

  const { login, signup, user, loading } = useAuth();
  const router = useRouter();

  const handleGoogleLogin = async (googleEmail: string, googleName: string, googleToken = 'mock_token', isMock = true) => {
    setError('');
    setSubmitting(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken, email: googleEmail, name: googleName, isMock })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Google Sign-In failed');
      }
      localStorage.setItem('tf_token', data.token);
      localStorage.setItem('tf_user', JSON.stringify(data.user));
      // Force reload to trigger global app layout AuthProvider reload
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Google Login failed');
      setSubmitting(false);
    }
  };

  const handleGoogleSignInClick = () => {
    setShowGoogleMock(true);
  };

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'ORGANIZER') {
        router.push('/dashboard');
      } else {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(name, email, password, role);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-height-screen h-screen">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-950/40">
      <div className="w-full max-w-md space-y-8 glass-panel p-8 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4 animate-bounce">
            <Ticket className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            TickrFlow
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {isLogin ? 'Log in to reserve your seats' : 'Create an account to start booking'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Continue with Google button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleSignInClick}
            className="w-full flex items-center justify-center gap-3 py-3 border border-white/10 bg-slate-900/40 hover:bg-slate-900/80 rounded-xl text-white font-semibold text-sm transition-all duration-200 cursor-pointer shadow-md active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <span className="relative px-3 bg-[#0a0f1d] text-xs font-semibold text-slate-500 uppercase tracking-wider">
            or use email authentication
          </span>
        </div>

        <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {!isLogin && (
              <div>
                <label className="sr-only" htmlFor="name">Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-white/10 bg-slate-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm"
                    placeholder="Full Name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="sr-only" htmlFor="email">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 bg-slate-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm"
                  placeholder="Email Address"
                />
              </div>
            </div>

            <div>
              <label className="sr-only" htmlFor="password">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 bg-slate-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm"
                  placeholder="Password (min 6 characters)"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Account Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('ATTENDEE')}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                      role === 'ATTENDEE'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-white/10 bg-slate-900/30 text-slate-400 hover:bg-slate-900/50'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    Attendee
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('ORGANIZER')}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                      role === 'ORGANIZER'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-white/10 bg-slate-900/30 text-slate-400 hover:bg-slate-900/50'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Organizer
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </div>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-all"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Quick Demo Login Credentials */}
        <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Demo Accounts</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmail('attendee@tickrflow.com');
                setPassword('password123');
                setIsLogin(true);
              }}
              className="py-2.5 px-3 rounded-xl border border-white/5 bg-slate-900/40 text-slate-300 hover:bg-slate-900 hover:text-white hover:border-indigo-500/20 text-center transition-all cursor-pointer font-medium"
            >
              Attendee Login
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('organizer@tickrflow.com');
                setPassword('password123');
                setIsLogin(true);
              }}
              className="py-2.5 px-3 rounded-xl border border-white/5 bg-slate-900/40 text-slate-300 hover:bg-slate-900 hover:text-white hover:border-indigo-500/20 text-center transition-all cursor-pointer font-medium"
            >
              Organizer Login
            </button>
          </div>
        </div>

        {/* Google Mock Account Selector Modal */}
        {showGoogleMock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white text-slate-900 rounded-2xl shadow-2xl p-6 space-y-6 relative border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowGoogleMock(false);
                  setShowCustomGoogleInput(false);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg cursor-pointer animate-pulse"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="text-center space-y-2">
                <svg className="h-8 w-8 mx-auto animate-bounce" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <h3 className="text-lg font-bold text-slate-800">Sign in with Google</h3>
                <p className="text-xs text-slate-500">Choose an account to continue to TickrFlow</p>
              </div>

              {!showCustomGoogleInput ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleGoogleLogin('surya.user@gmail.com', 'Surya')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 text-left transition-all cursor-pointer"
                  >
                    <div className="h-9 w-9 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-sm shrink-0">
                      S
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Surya</p>
                      <p className="text-xs text-slate-500">surya.user@gmail.com</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGoogleLogin('sarah.demo@gmail.com', 'Sarah')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 text-left transition-all cursor-pointer"
                  >
                    <div className="h-9 w-9 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-sm shrink-0">
                      S
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Sarah (Demo)</p>
                      <p className="text-xs text-slate-500">sarah.demo@gmail.com</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCustomGoogleInput(true)}
                    className="w-full py-3 text-center text-xs font-semibold text-indigo-600 hover:text-indigo-500 hover:bg-indigo-50/50 rounded-xl transition-all cursor-pointer"
                  >
                    Use another account
                  </button>
                </div>
              ) : (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customGoogleEmail) {
                      handleGoogleLogin(customGoogleEmail, customGoogleName);
                      setShowGoogleMock(false);
                      setShowCustomGoogleInput(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={customGoogleName}
                      onChange={(e) => setCustomGoogleName(e.target.value)}
                      placeholder="Your Name (e.g. John Doe)"
                      className="block w-full px-3 py-2 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                    <input
                      type="email"
                      required
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="block w-full px-3 py-2 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-grow py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomGoogleInput(false)}
                      className="py-2 px-4 border border-slate-300 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Back
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
