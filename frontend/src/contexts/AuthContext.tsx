import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

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
  
  // Cache to prevent duplicate simultaneous requests (persist across renders)
  const profileFetchCache = useRef(new Map<string, Promise<User | null>>());

  // Fetch user profile and role from Supabase
  const fetchUserProfile = async (supabaseUser: SupabaseUser): Promise<User | null> => {
    try {
      const userId = supabaseUser.id;
      
      // Check if there's already a pending request for this user
      if (profileFetchCache.current.has(userId)) {
        return await profileFetchCache.current.get(userId)!;
      }
      
      // Create the fetch promise and cache it
      const fetchPromise = (async () => {
        try {
          // Fetch profile and role in parallel
          const profileQuery = supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', userId)
            .maybeSingle(); // Use maybeSingle instead of single to handle missing profiles
          
          const rolesQuery = supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId);

          // Execute queries without aggressive timeout - let them complete naturally
          const [profileResult, rolesResult] = await Promise.allSettled([
            profileQuery,
            rolesQuery,
          ]);

          let profile = null;
          if (profileResult.status === 'fulfilled' && !profileResult.value.error) {
            profile = profileResult.value.data;
          } else if (profileResult.status === 'fulfilled' && profileResult.value.error) {
            // Only log non-404 errors (PGRST116 = not found)
            if (profileResult.value.error.code !== 'PGRST116') {
              console.error('Error fetching profile:', profileResult.value.error);
            }
          } else if (profileResult.status === 'rejected') {
            console.error('Profile query failed:', profileResult.reason);
          }

          let roles = null;
          if (rolesResult.status === 'fulfilled' && !rolesResult.value.error) {
            roles = rolesResult.value.data;
            console.log('Roles fetched successfully:', roles);
          } else if (rolesResult.status === 'fulfilled' && rolesResult.value.error) {
            console.error('Error fetching roles:', rolesResult.value.error);
            console.error('Error details:', {
              message: rolesResult.value.error.message,
              code: rolesResult.value.error.code,
              details: rolesResult.value.error.details,
              hint: rolesResult.value.error.hint,
            });
          } else if (rolesResult.status === 'rejected') {
            console.error('Roles query rejected:', rolesResult.reason);
          }

          console.log('Final roles data:', roles);
          // Check if user has admin role (user might have multiple roles)
          const hasAdminRole = roles && roles.some((r: any) => r.role === 'admin');
          const role: 'admin' | 'customer' = hasAdminRole ? 'admin' : 'customer';
          console.log('Determined role:', role, 'from roles:', roles, 'hasAdminRole:', hasAdminRole);

          return {
            id: userId,
            name: profile?.full_name || supabaseUser.email || 'User',
            email: supabaseUser.email || '',
            role,
            phone: profile?.phone || undefined,
          };
        } catch (error) {
          console.error('Error in fetchUserProfile:', error);
          return null;
        } finally {
          // Remove from cache after completion
          profileFetchCache.current.delete(userId);
        }
      })();
      
      // Cache the promise
      profileFetchCache.current.set(userId, fetchPromise);
      
      return await fetchPromise;
    } catch (error) {
      console.error('Error in fetchUserProfile wrapper:', error);
      return null;
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Quickly check if user is admin for immediate navigation
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle()
          .then(({ data: rolesData }) => {
            const isAdminUser = !!rolesData;
            if (isAdminUser) {
              // Navigate to admin dashboard immediately
              navigate('/admin/dashboard');
            }
          });
        
        // Fetch full profile in background
        fetchUserProfile(session.user).then((userData) => {
          if (userData) {
            setUser(userData);
            // Navigate to admin dashboard if user is admin
            if (userData.role === 'admin') {
              navigate('/admin/dashboard');
            }
          }
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Fetch profile in background, don't block
        // Use a flag to prevent duplicate fetches during login
        let shouldFetch = true;
        setUser((currentUser) => {
          // If user is already set with same ID, skip fetch
          if (currentUser && currentUser.id === session.user.id) {
            shouldFetch = false;
          }
          return currentUser;
        });
        
        if (shouldFetch) {
          fetchUserProfile(session.user)
            .then((userData) => {
              if (userData) {
                setUser(userData);
                // Only navigate to admin dashboard if:
                // 1. User is admin
                // 2. Event is SIGNED_IN (not token refresh)
                // 3. User is not already on an admin page
                if (userData.role === 'admin' && event === 'SIGNED_IN') {
                  const currentPath = window.location.pathname;
                  // Don't navigate if already on an admin page
                  if (!currentPath.startsWith('/admin')) {
                    navigate('/admin/dashboard');
                  }
                }
              }
            })
            .catch((error) => {
              console.error('Error fetching profile in onAuthStateChange:', error);
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error.message);
        throw error;
      }

      if (data.user) {
        // Use user metadata from auth response immediately
        const userMetadata = data.user.user_metadata || {};
        
        // Quickly check if user is admin before navigation
        // This is a fast query that should complete quickly
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();
        
        const isAdminUser = !!rolesData;
        
        const initialUser: User = {
          id: data.user.id,
          name: userMetadata.full_name || data.user.email || 'User',
          email: data.user.email || '',
          role: isAdminUser ? 'admin' : 'customer',
          phone: userMetadata.phone || undefined,
        };
        
        setUser(initialUser);
        toast.success('Welcome back!');
        
        // Navigate based on role immediately
        if (isAdminUser) {
          navigate('/admin/dashboard');
        } else {
          navigate('/');
        }
        
        // Fetch full profile in background to update with complete data
        setTimeout(() => {
          fetchUserProfile(data.user)
            .then((userData) => {
              if (userData) {
                setUser(userData);
                // If we discover user is admin after full profile fetch, navigate to dashboard
                if (userData.role === 'admin' && !isAdminUser) {
                  navigate('/admin/dashboard');
                }
              }
            })
            .catch((error) => {
              console.error('Error fetching profile:', error);
              // Don't show error to user, they're already logged in
            });
        }, 500);
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const register = async (name: string, phone: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone || null,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // The trigger will automatically create the profile
        // Wait a bit for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to fetch user profile (trigger should have created it)
        const userData = await fetchUserProfile(data.user);
        if (userData) {
          setUser(userData);
          toast.success('Account created successfully!');
          navigate('/');
        } else {
          // If profile doesn't exist yet, wait a bit more and try again
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryUserData = await fetchUserProfile(data.user);
          if (retryUserData) {
            setUser(retryUserData);
            toast.success('Account created successfully!');
            navigate('/');
          } else {
            // Profile creation might have failed, but user is created
            const initialUser: User = {
              id: data.user.id,
              name: name,
              email: data.user.email || email,
              role: 'customer',
              phone: phone || undefined,
            };
            setUser(initialUser);
            toast.success('Account created! Please check your email to confirm your account.');
            navigate('/');
          }
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed');
      throw error;
    }
  };

  const logout = async () => {
    // Check if there's an active session before trying to sign out
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Only try to sign out if there's an active session
        const { error } = await supabase.auth.signOut();
        if (error && error.message !== 'Auth session missing!') {
          console.warn('Signout error:', error);
        }
      }
    } catch (error: any) {
      // Ignore errors - we'll clear local state anyway
      console.warn('Signout error (ignored):', error);
    }
    
    // Always clear local state regardless of signOut result
    setUser(null);
    profileFetchCache.current.clear();
    
    // Clear auth-related localStorage items
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Ignore storage errors
      console.warn('Error clearing localStorage:', e);
    }
    
    toast.success('Logged out successfully');
    navigate('/');
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

