import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/lib/api";

const TokenPaymentPage = () => {
  const { bookingId } = useParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [qrError, setQrError] = useState<boolean>(false);
  const [booking, setBooking] = useState<any>(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const TOKEN_AMOUNT = 5000; // Fixed token amount

  useEffect(() => {
    const init = async () => {
      if (!bookingId) return;
      try {
        const bookingRes = await api.getBooking(bookingId);
        const bookingRow = bookingRes.data;
        setBooking(bookingRow);
        
        // Check if token already paid
        if ((bookingRow as any).payment_status === 'token_paid' || (bookingRow as any).token_paid >= TOKEN_AMOUNT) {
          toast.info("Token payment already completed");
          navigate("/bookings");
          return;
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to initialize payment");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [bookingId, navigate]);
  
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = async () => {
    if (!bookingId) return;
    try {
      if (!paymentScreenshot) {
        toast.error("Payment screenshot is required");
        return;
      }

      await api.confirmPaymentWithScreenshot(bookingId, paymentScreenshot, {
        amount: TOKEN_AMOUNT,
        isTokenPayment: true,
      });

      toast.success("Token payment submitted successfully! Your booking is confirmed. Please upload ID proofs.");
      navigate(`/bookings/${bookingId}/id-proof`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to record payment");
    }
  };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Pay Token Amount</CardTitle>
            <p className="text-base font-semibold text-primary italic mt-2">
              Live a day the farm way
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Initializing...</div>
            ) : (
              <div className="space-y-6">
                {booking && (
                  <div className="space-y-3 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold text-lg mb-2">Booking Summary</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Total Booking Amount</span>
                        <span>{formatINR(Number(booking.total_amount || 0))}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-base pt-2 border-t">
                        <span>Token Amount (Non-refundable)</span>
                        <span className="text-primary">{formatINR(TOKEN_AMOUNT)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground pt-1">
                        Remaining amount: {formatINR(Math.max(0, Number(booking.total_amount || 0) - TOKEN_AMOUNT))}
                      </div>
                      <div className="text-xs text-destructive/80 pt-1">
                        ⚠️ Full payment must be completed at least 48 hours before check-in date
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center space-y-4">
                  <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed overflow-hidden">
                    {!qrError ? (
                      <img
                        src={import.meta.env.VITE_UPI_QR_CODE_URL || "/upi-qr-code.png"}
                        alt="UPI QR Code"
                        className="w-full h-full object-contain"
                        onError={() => setQrError(true)}
                      />
                    ) : (
                      <p className="text-muted-foreground text-xs text-center p-4">
                        Place your QR code image at /public/upi-qr-code.png or set VITE_UPI_QR_CODE_URL
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">UPI ID</p>
                    <p className="text-lg font-semibold">{import.meta.env.VITE_UPI_ID || "george.j.alexander77-1@okaxis"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-primary">Amount to Pay: {formatINR(TOKEN_AMOUNT)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium block">Payment Screenshot <span className="text-destructive">*</span></label>
                  <input
                    ref={screenshotRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="hidden"
                    required
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => screenshotRef.current?.click()}
                      className="flex-1"
                    >
                      {paymentScreenshot ? "Change Screenshot" : "Upload Screenshot"}
                    </Button>
                    {paymentScreenshot && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setPaymentScreenshot(null);
                          setScreenshotPreview(null);
                          if (screenshotRef.current) screenshotRef.current.value = '';
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {screenshotPreview && (
                    <div className="mt-2">
                      <img src={screenshotPreview} alt="Payment screenshot preview" className="w-full max-h-48 object-contain rounded border" />
                    </div>
                  )}
                  {!paymentScreenshot && (
                    <p className="text-xs text-destructive">Payment screenshot is required</p>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> This token amount of ₹5,000 is non-refundable. 
                    After payment verification, your booking will be confirmed and you will receive a guest relations call.
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleConfirm} 
                  disabled={!paymentScreenshot}
                >
                  Submit Token Payment
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TokenPaymentPage;

