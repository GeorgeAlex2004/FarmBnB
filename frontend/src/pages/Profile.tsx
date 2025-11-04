import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { getAuth, updateProfile } from "firebase/auth";

const Profile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Only fetch profile if user is logged in
    if (!user || loading) {
      return;
    }

    (async () => {
      try {
        const res = await api.getProfile();
        if (res.success && res.data) {
          setFullName(res.data.full_name || user?.name || "");
          setPhone(res.data.phone || "");
        } else {
          setFullName(user?.name || "");
        }
      } catch (error: any) {
        // If 401, user might not be logged in properly
        if (error?.message?.includes('Unauthorized') || error?.message?.includes('401')) {
          console.warn('Profile fetch failed - user may not be authenticated');
        }
        setFullName(user?.name || "");
      }
    })();
  }, [user, loading]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const auth = getAuth();
      if (auth.currentUser && fullName) {
        await updateProfile(auth.currentUser, { displayName: fullName });
      }
      await api.updateProfileSupabase({ full_name: fullName || null as any, phone: phone || null as any });
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };


  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is not logged in (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>

        <Card className="shadow-soft">
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone number" />
            </div>
            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;


