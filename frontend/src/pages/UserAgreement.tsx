import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const UserAgreement = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false); // Track if user has agreed to prevent cancellation

  const cancelBookingMutation = useMutation({
    mutationFn: (id: string) => api.cancelBooking(id, "User rejected terms and conditions"),
    onSuccess: () => {
      toast.success("Booking cancelled");
      navigate("/properties");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to cancel booking");
    },
  });

  const handleProceed = () => {
    if (agreed && bookingId) {
      setHasAgreed(true); // Mark as agreed to prevent cancellation
      navigate(`/bookings/${bookingId}/token-payment`);
    }
  };

  const handleCancel = () => {
    if (bookingId && !hasAgreed) {
      if (confirm("Are you sure you want to reject the terms and conditions? Your booking will be cancelled.")) {
        cancelBookingMutation.mutate(bookingId);
      }
    } else {
      navigate(-1);
    }
  };

  // Handle browser back button or tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasAgreed && bookingId) {
        e.preventDefault();
        e.returnValue = "";
        // Cancel booking when user tries to close tab/window
        if (bookingId) {
          api.cancelBooking(bookingId, "User closed agreement page without accepting terms").catch(() => {
            // Silently fail if cancellation doesn't work (user might have already cancelled)
          });
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasAgreed, bookingId]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Terms & Conditions</CardTitle>
          <p className="text-lg font-semibold text-primary italic mt-2 mb-1">
            Live a day the farm way
          </p>
          <CardDescription>
            Please read and agree to the following terms and conditions before proceeding with your booking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4 mb-6">
            <div className="space-y-6 text-sm">
              <section>
                <h3 className="font-semibold text-base mb-2">1. Booking Terms</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>All bookings require a non-refundable token payment of ₹5,000 to confirm your reservation.</li>
                  <li>The token payment must be completed immediately after booking creation.</li>
                  <li>Full payment must be completed at least 48 hours before your check-in date.</li>
                  <li>Bookings are subject to availability and property confirmation.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">2. Payment Policy</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Token payment of ₹5,000 is non-refundable under any circumstances.</li>
                  <li>Full payment must be completed at least 48 hours before check-in.</li>
                  <li>Failure to complete full payment within the deadline may result in booking cancellation.</li>
                  <li>All payments are processed through UPI or other approved payment methods.</li>
                  <li>Payment confirmation may take up to 24 hours to reflect in your booking status.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">3. Cancellation & Refund Policy</h3>
                <Alert className="mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Important:</strong> The token payment of ₹5,000 is non-refundable under all circumstances.
                  </AlertDescription>
                </Alert>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Token Payment (₹5,000):</strong> Non-refundable under any circumstances.</li>
                  <li><strong>Cancellation 1 day before check-in:</strong> Only 50% of the remaining amount (excluding token) will be refunded.</li>
                  <li><strong>Cancellation more than 1 day before check-in:</strong> Full refund of the remaining amount (excluding token) will be processed.</li>
                  <li><strong>No-show:</strong> No refund will be provided.</li>
                  <li>Refunds will be processed within 7-14 business days to the original payment method.</li>
                  <li>All cancellation requests must be submitted through the booking portal or by contacting customer support.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">4. ID Verification</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>You are required to upload exactly 2 valid ID proofs for record-keeping purposes.</li>
                  <li>Failure to provide ID proofs may delay your booking confirmation.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">5. Food & Dietary Requirements</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Food is included in the base price for all bookings.</li>
                  <li>You must specify your food preferences: All Veg, All Non-Veg, or Both.</li>
                  <li>If selecting "Both", you must specify the number of vegetarian and non-vegetarian guests.</li>
                  <li>Please inform us of any allergies or dietary restrictions at the time of booking.</li>
                  <li>Special dietary requirements should be communicated at least 48 hours before check-in.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">6. Guest Capacity & Pricing</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>The base price covers up to 4 guests.</li>
                  <li>Additional guests beyond 4 will incur extra charges per guest per day.</li>
                  <li>All pricing is inclusive of food and basic amenities.</li>
                  <li>Pricing is calculated based on the number of days and guests.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">7. Check-in & Check-out</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Standard check-in time is 8:00 AM and check-out time is 7:00 PM.</li>
                  <li>Early check-in or late check-out may be available upon request and subject to availability.</li>
                  <li>Guests must provide valid identification at check-in.</li>
                  <li>Property access details will be shared after full payment confirmation.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">8. Property Rules & Conduct</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Guests are expected to maintain cleanliness and respect the property.</li>
                  <li>Smoking may be restricted to designated areas only.</li>
                  <li>Loud music and parties may be restricted based on property rules.</li>
                  <li>Any damage to property will be charged to the guest.</li>
                  <li>Pets may or may not be allowed based on property-specific rules.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">9. Liability & Insurance</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>The property owner is not liable for any personal injury, loss, or damage to personal belongings.</li>
                  <li>Guests are advised to secure their own travel insurance if needed.</li>
                  <li>Any activities undertaken by guests are at their own risk.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">10. Force Majeure</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>In case of natural disasters, government restrictions, or other force majeure events, refunds will be handled on a case-by-case basis.</li>
                  <li>The token payment remains non-refundable even in force majeure situations.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">11. Dispute Resolution</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Any disputes will be resolved through mutual discussion and negotiation.</li>
                  <li>If disputes cannot be resolved, they will be subject to the jurisdiction of the local courts.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">12. Contact & Support</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>For booking-related queries, contact our customer support team.</li>
                  <li>All communication regarding bookings will be sent to your registered email and phone number.</li>
                </ul>
              </section>
            </div>
          </ScrollArea>

          <div className="border-t pt-6 space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                className="mt-1"
              />
              <label
                htmlFor="agree"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I have read, understood, and agree to all the terms and conditions stated above. I acknowledge that:
                <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                  <li>The token payment of ₹5,000 is non-refundable.</li>
                  <li>If I cancel 1 day before the booking date, only 50% of the remaining amount (excluding token) will be refunded.</li>
                  <li>I must complete full payment at least 48 hours before check-in.</li>
                  <li>I will provide 2 valid ID proofs for record-keeping.</li>
                </ul>
              </label>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleProceed}
                disabled={!agreed}
                className="flex-1"
                size="lg"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                I Agree & Proceed to Payment
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                size="lg"
                disabled={cancelBookingMutation.isPending}
              >
                {cancelBookingMutation.isPending ? "Cancelling..." : "Cancel"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserAgreement;

