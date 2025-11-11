import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile as fbUpdateProfile } from 'firebase/auth';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  phone?: string;
  address?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, phone: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Fetch profile from backend (which reads Supabase) to get role/phone
      try {
        // Check custom claims on the ID token to derive admin role
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const isAdminClaim = tokenResult?.claims?.admin === true || tokenResult?.claims?.role === 'admin';

        const res = await api.getProfile();
        const role = isAdminClaim ? 'admin' : 'customer';
        const profile: User = {
          id: firebaseUser.uid,
          name: (res.data as any)?.full_name || firebaseUser.email || 'User',
          email: firebaseUser.email || '',
          role,
          phone: (res.data as any)?.phone || undefined,
        };
        setUser(profile);
      } catch {
        const profileFallback: User = {
          id: firebaseUser.uid,
          name: firebaseUser.email || 'User',
          email: firebaseUser.email || '',
          role: 'customer',
        };
        setUser(profileFallback);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePostAuthProfile = async (uid: string, name?: string, phone?: string) => {
    try {
      // Ensure profile row exists in Supabase via backend
      await api.updateProfileSupabase({
        ...(name ? { full_name: name } : {}),
        ...(phone ? { phone } : {}),
      });
    } catch {
      // Non-fatal
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const auth = getAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await handlePostAuthProfile(cred.user.uid);
      toast.success('Welcome back!');
      navigate((user?.role === 'admin') ? '/admin/dashboard' : '/');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const register = async (name: string, phone: string, email: string, password: string) => {
    try {
      const auth = getAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await fbUpdateProfile(cred.user, { displayName: name });
      } catch {}
      await handlePostAuthProfile(cred.user.uid, name, phone);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
      throw error;
    }
  };

  const logout = () => {
    const auth = getAuth();
    auth.signOut().finally(() => {
      setUser(null);
      toast.success('Logged out successfully');
      navigate('/');
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

