import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

const UploadIdProof = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'approved'>('idle');
  const [idProofs, setIdProofs] = useState<string[]>([]);

  const loadBooking = async () => {
    try {
      if (!bookingId) return;
      const res = await api.getBooking(bookingId);
      const booking = res.data;
      const vs = (booking?.verification_status as string) || 'pending';
      setStatus(vs === 'approved' ? 'approved' : 'pending');
      // Load existing ID proofs
      if (booking?.id_proofs && Array.isArray(booking.id_proofs)) {
        setIdProofs(booking.id_proofs);
      }
    } catch (error) {
      console.error('Failed to load booking:', error);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const onUpload = async (files: FileList | null) => {
    if (!bookingId) return;
    if (!files || files.length !== 2) {
      toast.error('Please select exactly 2 ID proof files');
      return;
    }
    setUploading(true);
    try {
      await api.uploadBookingIdProofs(bookingId, Array.from(files));
      setStatus('approved');
      toast.success('ID proofs uploaded successfully.');
      // Reload booking to get updated ID proofs
      await loadBooking();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload ID proofs');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Upload ID Proofs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Please upload exactly 2 Government ID proofs (Aadhaar preferred). These are required for record-keeping purposes.</p>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
            <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className="w-full">
              {uploading ? 'Uploading...' : 'Select 2 ID Proofs'}
            </Button>
            
            {/* Display uploaded ID proofs */}
            {idProofs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Uploaded ID Proofs ({idProofs.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {idProofs.map((proofUrl: string, index: number) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      {proofUrl.toLowerCase().endsWith('.pdf') ? (
                        <div className="p-4 bg-muted">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">ID Proof {index + 1} (PDF)</span>
                            <Button size="sm" variant="outline" onClick={() => window.open(proofUrl, '_blank')}>
                              Open PDF
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <img 
                            src={proofUrl} 
                            alt={`ID Proof ${index + 1}`}
                            className="w-full h-auto max-h-64 object-contain bg-muted"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              onClick={() => window.open(proofUrl, '_blank')}
                              className="bg-black/50 text-white hover:bg-black/70"
                            >
                              Open Full Size
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {status === 'approved' && idProofs.length >= 2 && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200 text-sm text-green-900">
                ✓ ID proofs uploaded successfully. Your booking is complete.
              </div>
            )}
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => navigate('/bookings')}>Go to My Bookings</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadIdProof;


