'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'ORGANIZER' | 'ATTENDEE';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithData: (token: string, user: User) => void;
  signup: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  loginWithData: () => {},
  signup: async () => {},
  logout: () => {},
  getAuthHeaders: () => ({}),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Read from localStorage on mount
    const savedToken = localStorage.getItem('tf_token');
    const savedUser = localStorage.getItem('tf_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to parse saved user credentials:', err);
        localStorage.removeItem('tf_token');
        localStorage.removeItem('tf_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('tf_token', data.token);
    localStorage.setItem('tf_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    
    // Redirect based on role
    if (data.user.role === 'ORGANIZER') {
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  };

  const signup = async (name: string, email: string, password: string, role: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    localStorage.setItem('tf_token', data.token);
    localStorage.setItem('tf_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);

    if (data.user.role === 'ORGANIZER') {
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  };

  const loginWithData = (jwtToken: string, userData: User) => {
    localStorage.setItem('tf_token', jwtToken);
    localStorage.setItem('tf_user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
    if (userData.role === 'ORGANIZER') {
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  };

  const logout = () => {
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithData, signup, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};
