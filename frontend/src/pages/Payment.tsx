import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";

const PaymentPage = () => {
  const { bookingId } = useParams();
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [referenceId, setReferenceId] = useState<string>("");
  const [qrError, setQrError] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      if (!bookingId) return;
      try {
        const res = await api.createPaymentIntent(bookingId);
        setAmount(res.amount);
      } catch (e: any) {
        toast.error(e?.message || "Failed to initialize payment");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [bookingId]);
  
  const handleConfirm = async () => {
    if (!bookingId) return;
    try {
      await api.confirmPayment(bookingId, "manual", undefined /* optional: paymentIntentId not used */, { referenceId, amount });
      toast.success("Payment details submitted. Admin will verify the transaction and confirm your booking.");
      navigate("/bookings");
    } catch (e: any) {
      toast.error(e?.message || "Failed to record payment");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Complete Payment</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Initializing...</div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2">Advance amount (50%): {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)}</div>
                </div>

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
                    <p className="text-lg font-semibold">{import.meta.env.VITE_UPI_ID || "yourname@upi"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium block">Transaction ID</label>
                  <Input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="Enter transaction ID after payment"
                    className="w-full"
                  />
                </div>

                <Button className="w-full" onClick={handleConfirm} disabled={!referenceId.trim()}>I've paid</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentPage;


