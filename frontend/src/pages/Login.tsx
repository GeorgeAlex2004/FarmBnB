import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Home, Mail, Lock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { getAuth, sendPasswordResetEmail, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

const Login = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPhase, setOtpPhase] = useState<"idle" | "sending" | "codeSent" | "verifying" | "verified">("idle");
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        // Enforce phone verification prior to account creation
        if (otpPhase !== "verified") {
          setLoading(false);
          return toast.error("Please verify your phone number with OTP first");
        }
        await register(name, phone, email, password);
      }
    } catch (error: any) {
      // Error already handled in auth context
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, resetEmail || email);
      toast.success("Password reset email sent");
      setResetOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reset email");
    }
  };

  // Cleanup reCAPTCHA on unmount or mode switch
  useEffect(() => {
    return () => {
      // Clean up reCAPTCHA verifier when component unmounts or switches modes
      if ((window as any).reCaptchaVerifier) {
        try {
          ((window as any).reCaptchaVerifier as RecaptchaVerifier).clear();
        } catch (_) {
          // ignore cleanup errors
        }
        delete (window as any).reCaptchaVerifier;
      }
    };
  }, [isLogin]);

  const sendOtp = async () => {
    try {
      if (!phone) return toast.error("Enter phone number");
      
      // Format phone number to E.164 format (+91XXXXXXXXXX)
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        // Remove all non-digits
        const digits = formattedPhone.replace(/[^0-9]/g, '');
        // Add +91 for India if not present
        formattedPhone = `+91${digits}`;
      }
      
      setOtpPhase("sending");
      const auth = getAuth();
      
      // Clean up existing verifier if it exists
      if ((window as any).reCaptchaVerifier) {
        try {
          ((window as any).reCaptchaVerifier as RecaptchaVerifier).clear();
        } catch (_) {
          // ignore cleanup errors
        }
        delete (window as any).reCaptchaVerifier;
      }
      
      // Create new verifier
      if (!recaptchaRef.current) {
        throw new Error("reCAPTCHA container not ready");
      }
      
      const verifier = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          // reCAPTCHA expired
          toast.error("reCAPTCHA expired. Please try again.");
        }
      });
      
      (window as any).reCaptchaVerifier = verifier;
      
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      confirmationResultRef.current = result;
      setOtpPhase("codeSent");
      toast.success("OTP sent to your phone");
    } catch (err: any) {
      setOtpPhase("idle");
      // Clean up verifier on error
      if ((window as any).reCaptchaVerifier) {
        try {
          ((window as any).reCaptchaVerifier as RecaptchaVerifier).clear();
        } catch (_) {}
        delete (window as any).reCaptchaVerifier;
      }
      toast.error(err?.message || "Failed to send OTP");
    }
  };

  const verifyOtp = async () => {
    try {
      if (!otp) return toast.error("Enter the OTP");
      setOtpPhase("verifying");
      const cr = confirmationResultRef.current;
      if (!cr) throw new Error("No OTP session. Please resend OTP.");
      await cr.confirm(otp);
      setOtpPhase("verified");
      toast.success("Phone verified");
    } catch (err: any) {
      setOtpPhase("codeSent");
      toast.error(err?.message || "Invalid OTP");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl animate-scale-in">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Link to="/" className="flex items-center gap-2 group">
              <Home className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
              <span className="text-3xl font-bold bg-gradient-hero-text">
                FarmBnB
              </span>
            </Link>
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Phone *
                </label>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="e.g., +91XXXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <Button type="button" variant="outline" onClick={sendOtp} disabled={otpPhase === 'sending' || otpPhase === 'verified'}>
                    {otpPhase === 'sending' ? 'Sending...' : (otpPhase === 'codeSent' ? 'Resend OTP' : 'Send OTP')}
                  </Button>
                </div>
                {otpPhase === 'codeSent' || otpPhase === 'verifying' ? (
                  <div className="mt-2 flex gap-2">
                    <Input type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                    <Button type="button" onClick={verifyOtp} disabled={otpPhase === 'verifying'}>
                      {otpPhase === 'verifying' ? 'Verifying...' : 'Verify'}
                    </Button>
                  </div>
                ) : null}
                <div ref={recaptchaRef} />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || (!isLogin && otpPhase !== 'verified')} size="lg">
              {loading
                ? "Please wait..."
                : isLogin
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline transition-all"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
            {isLogin && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => { setResetEmail(email); setResetOpen(true); }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg text-sm">
            <p className="font-semibold mb-2">Demo Credentials:</p>
            <p className="text-muted-foreground">
              Create an account or contact admin for access
            </p>
          </div>
        </CardContent>
      </Card>

      {resetOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Reset password</h3>
            <p className="text-sm text-muted-foreground mb-4">Enter your account email to receive a reset link.</p>
            <form onSubmit={handlePasswordReset} className="space-y-3">
              <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required placeholder="you@example.com" />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
                <Button type="submit">Send reset link</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
