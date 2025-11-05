import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import api from "@/lib/api";
import { Calendar, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";

const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

// Calculate advance amount (50% of total) with same rounding as backend
const calculateAdvance = (total: number) => Math.round(total * 0.5 * 100) / 100;

const MyBookings = () => {
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const res = await api.getBookings({ limit: 100 });
      return res.data || [];
    }
  });

  const formatDate = (date: string | Date | undefined): string => {
    if (!date) return "N/A";
    try {
      const dateObj = typeof date === "string" ? parseISO(date) : new Date(date);
      if (!isValid(dateObj)) return "Invalid Date";
      return format(dateObj, "MMM dd, yyyy");
    } catch {
      return "Invalid Date";
    }
  };

  const handleViewBooking = (booking: any) => {
    setSelectedBooking(booking);
    setDetailsDialogOpen(true);
  };

  const { upcoming, past, pendingApproval, pendingPayment, pendingPaymentConfirmation, cancelled } = useMemo(() => {
    const now = new Date();
    const list = Array.isArray(data) ? data : [];
    const withDates = list.map((b: any) => ({
      ...b,
      _checkIn: new Date(b.check_in_date || b.checkIn),
      _checkOut: new Date(b.check_out_date || b.checkOut),
    }));
    
    // Filter bookings by status
    const pendingApproval = withDates.filter(b => (b.verification_status || 'pending') === 'pending');
    
    // Separate pending payment into two categories:
    // 1. pendingPayment - needs payment (no payment screenshot/reference yet)
    // 2. pendingPaymentConfirmation - payment submitted, waiting for admin confirmation
    const pendingPaymentAll = withDates.filter(b => 
      (b.verification_status || 'pending') === 'approved' && (b.status || 'pending') === 'pending'
    );
    
    const pendingPaymentConfirmation = pendingPaymentAll.filter(b => 
      b.payment_screenshot_url || b.manual_reference
    );
    
    const pendingPayment = pendingPaymentAll.filter(b => 
      !b.payment_screenshot_url && !b.manual_reference
    );
    
    // Upcoming: confirmed bookings with check-out date in future, exclude pending approval/payment and cancelled
    const upcoming = withDates
      .filter(b => {
        const status = (b.status || '').toLowerCase();
        const isPendingApproval = (b.verification_status || 'pending') === 'pending';
        const isPendingPayment = (b.verification_status || 'pending') === 'approved' && status === 'pending' && !b.payment_screenshot_url && !b.manual_reference;
        const isPendingPaymentConfirmation = (b.verification_status || 'pending') === 'approved' && status === 'pending' && (b.payment_screenshot_url || b.manual_reference);
        const isCancelled = status === 'cancelled';
        return b._checkOut >= now && !isPendingApproval && !isPendingPayment && !isPendingPaymentConfirmation && !isCancelled && status === 'confirmed';
      })
      .sort((a,b) => a._checkIn.getTime() - b._checkIn.getTime());
    
    // Past: bookings with check-out date in past, exclude pending approval/payment
    const past = withDates
      .filter(b => {
        const isPendingApproval = (b.verification_status || 'pending') === 'pending';
        const isPendingPayment = (b.verification_status || 'pending') === 'approved' && (b.status || 'pending') === 'pending' && !b.payment_screenshot_url && !b.manual_reference;
        const isPendingPaymentConfirmation = (b.verification_status || 'pending') === 'approved' && (b.status || 'pending') === 'pending' && (b.payment_screenshot_url || b.manual_reference);
        return b._checkOut < now && !isPendingApproval && !isPendingPayment && !isPendingPaymentConfirmation;
      })
      .sort((a,b) => b._checkOut.getTime() - a._checkOut.getTime());
    
    // Cancelled: separate section for cancelled bookings
    const cancelled = withDates
      .filter(b => (b.status || '').toLowerCase() === 'cancelled')
      .sort((a,b) => b._checkOut.getTime() - a._checkOut.getTime());
    
    return { upcoming, past, pendingApproval, pendingPayment, pendingPaymentConfirmation, cancelled };
  }, [data]);

  // Combine all active bookings
  const activeBookings = useMemo(() => {
    return [
      ...pendingApproval.map((b: any) => ({ ...b, _status: 'pending_approval' })),
      ...pendingPayment.map((b: any) => ({ ...b, _status: 'pending_payment' })),
      ...pendingPaymentConfirmation.map((b: any) => ({ ...b, _status: 'pending_payment_confirmation' })),
      ...upcoming.map((b: any) => ({ ...b, _status: 'confirmed' })),
    ].sort((a, b) => {
      // Sort by priority: pending approval > pending payment > pending payment confirmation > confirmed
      const priority: Record<string, number> = {
        'pending_approval': 1,
        'pending_payment': 2,
        'pending_payment_confirmation': 3,
        'confirmed': 4,
      };
      return (priority[a._status] || 99) - (priority[b._status] || 99);
    });
  }, [pendingApproval, pendingPayment, pendingPaymentConfirmation, upcoming]);

  // Combine history bookings
  const historyBookings = useMemo(() => {
    return [
      ...past.map((b: any) => ({ ...b, _status: 'past' })),
      ...cancelled.map((b: any) => ({ ...b, _status: 'cancelled' })),
    ].sort((a, b) => {
      const dateA = new Date(a.check_out_date || a.checkOut || 0).getTime();
      const dateB = new Date(b.check_out_date || b.checkOut || 0).getTime();
      return dateB - dateA;
    });
  }, [past, cancelled]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      'pending_approval': { label: 'Pending Approval', className: 'bg-orange-100 text-orange-700' },
      'pending_payment': { label: 'Pending Payment', className: 'bg-amber-100 text-amber-700' },
      'pending_payment_confirmation': { label: 'Payment Confirmation', className: 'bg-blue-100 text-blue-700' },
      'confirmed': { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
      'past': { label: 'Completed', className: 'bg-muted text-foreground/70' },
      'cancelled': { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
    };
    return badges[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  };

  const renderBookingCard = (b: any) => {
    const statusBadge = getStatusBadge(b._status);
    const isCancelled = b._status === 'cancelled';
    
    return (
      <Card key={b.id || b._id} className={`shadow-soft ${isCancelled ? 'opacity-75' : ''}`}>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg line-clamp-1">{b.property?.name || b.property_name || 'Property'}</h3>
            <span className={`text-xs px-2 py-1 rounded capitalize ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              {(() => {
                const ci = typeof b.check_in_date === 'string' ? parseISO(b.check_in_date) : new Date(b.check_in_date || '');
                const co = typeof b.check_out_date === 'string' ? parseISO(b.check_out_date) : new Date(b.check_out_date || '');
                const ciStr = isValid(ci) ? format(ci, 'MMM dd, yyyy') : '—';
                const coStr = isValid(co) ? format(co, 'MMM dd, yyyy') : '—';
                return `${ciStr} → ${coStr}`;
              })()}
            </span>
          </div>
          {b.property?.location && b._status === 'confirmed' && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="line-clamp-1">{b.property.location?.address || b.property.location}</span>
            </div>
          )}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-sm">
              <div>Total: <span className="font-semibold">{formatINR(Number(b.total_amount ?? 0))}</span></div>
              {b._status === 'pending_payment_confirmation' && b.advance_paid ? (
                <div className="text-xs text-muted-foreground">
                  Advance paid: <span className="font-semibold text-green-600">{formatINR(Number(b.advance_paid ?? 0))}</span>
                </div>
              ) : b._status !== 'cancelled' && b._status !== 'past' ? (
                <div className="text-xs text-muted-foreground">
                  {b._status === 'pending_approval' || b._status === 'pending_payment' 
                    ? `Advance to pay: ${formatINR(calculateAdvance(Number(b.total_amount ?? 0)))}`
                    : `Advance: ${formatINR(Number(b.advance_paid ?? 0))}`}
                </div>
              ) : (
                b.advance_paid > 0 && (
                  <div className="text-xs text-muted-foreground">Advance: {formatINR(Number(b.advance_paid ?? 0))}</div>
                )
              )}
              {b._status === 'pending_payment_confirmation' && b.manual_reference && (
                <div className="text-xs text-muted-foreground mt-1">
                  Transaction ID: <span className="font-mono">{b.manual_reference}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {b._status === 'pending_approval' && (
                <Link to={`/bookings/${b.id || b._id}/id-proof`}>
                  <Button variant="outline" size="sm">View</Button>
                </Link>
              )}
              {b._status === 'pending_payment' && (
                <>
                  <Link to={`/payments/${b.id || b._id}`}>
                    <Button size="sm">Pay Now</Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to cancel this booking?")) {
                        api.cancelBooking(b.id || b._id).then(() => location.reload());
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {b._status === 'pending_payment_confirmation' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Are you sure you want to cancel this booking?")) {
                      api.cancelBooking(b.id || b._id).then(() => location.reload());
                    }
                  }}
                >
                  Cancel
                </Button>
              )}
              {(b._status === 'confirmed' || b._status === 'past') && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleViewBooking(b)}>
                    View
                  </Button>
                  {b._status === 'confirmed' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => api.cancelBooking(b.id || b._id).then(() => location.reload())}
                    >
                      Cancel
                    </Button>
                  )}
                </>
              )}
              {(b._status === 'cancelled') && (
                <Button variant="outline" size="sm" onClick={() => handleViewBooking(b)}>
                  View
                </Button>
              )}
            </div>
          </div>
          {b._status === 'pending_payment_confirmation' && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
              Payment submitted. Admin will verify and confirm your booking shortly.
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-bold mb-6">My Bookings</h1>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_,i) => (<div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />))}
          </div>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="active">
                Active ({activeBookings.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                History ({historyBookings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-6">
              {activeBookings.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <p className="text-lg">No active bookings</p>
                  <p className="text-sm mt-2">Your upcoming and pending bookings will appear here</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeBookings.map(renderBookingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              {historyBookings.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <p className="text-lg">No booking history</p>
                  <p className="text-sm mt-2">Your past and cancelled bookings will appear here</p>
                </Card>
              ) : (
                <>
                  {past.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-4">Completed Bookings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {past.map((b: any) => renderBookingCard({ ...b, _status: 'past' }))}
                      </div>
                    </div>
                  )}
                  {cancelled.length > 0 && (
                    <div>
                      <Collapsible open={showCancelled} onOpenChange={setShowCancelled}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between mb-4">
                            <span className="font-semibold">Cancelled Bookings ({cancelled.length})</span>
                            {showCancelled ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {cancelled.map((b: any) => renderBookingCard({ ...b, _status: 'cancelled' }))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Booking Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
              <DialogDescription>
                View complete details of your booking
              </DialogDescription>
            </DialogHeader>
            {selectedBooking && (
              <div className="space-y-6 py-4">
                {/* Basic Booking Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Booking Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Property:</span>{" "}
                      <span>{selectedBooking.property?.name || selectedBooking.property_name || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="font-medium">Booking ID:</span>{" "}
                      <span className="font-mono text-xs">{selectedBooking.id || selectedBooking._id}</span>
                    </div>
                    <div>
                      <span className="font-medium">Check-in:</span>{" "}
                      <span>{formatDate(selectedBooking.check_in_date)}</span>
                    </div>
                    <div>
                      <span className="font-medium">Check-out:</span>{" "}
                      <span>{formatDate(selectedBooking.check_out_date)}</span>
                    </div>
                    <div>
                      <span className="font-medium">Number of Guests:</span>{" "}
                      <span>{selectedBooking.num_guests || selectedBooking.numberOfGuests || 0}</span>
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>{" "}
                      <span className="capitalize">{selectedBooking.status || 'pending'}</span>
                    </div>
                  </div>

                  {/* Food Preferences */}
                  {(selectedBooking.food_required !== undefined || selectedBooking.food_preference || selectedBooking.allergies) && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Food Preferences</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Food Required:</span>{" "}
                          <span>{selectedBooking.food_required ? 'Yes' : 'No'}</span>
                        </div>
                        {selectedBooking.food_preference && (
                          <div>
                            <span className="font-medium">Food Preference:</span>{" "}
                            <span className="capitalize">{selectedBooking.food_preference}</span>
                          </div>
                        )}
                        {selectedBooking.allergies && (
                          <div className="col-span-2">
                            <span className="font-medium">Allergies:</span>{" "}
                            <span>{selectedBooking.allergies}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cost Breakdown */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Cost Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Base amount (1 day):</span>
                        <span>{formatINR(Number(selectedBooking.base_amount || 0))}</span>
                      </div>
                      {Number(selectedBooking.guest_charges || 0) > 0 && (
                        <div className="flex justify-between">
                          <span>Guest charges ({selectedBooking.num_guests || 0} guests):</span>
                          <span>{formatINR(Number(selectedBooking.guest_charges || 0))}</span>
                        </div>
                      )}
                      {Number(selectedBooking.extra_fees || 0) > 0 && (
                        <div className="flex justify-between">
                          <span>Extra fees (food, cleaning, service):</span>
                          <span>{formatINR(Number(selectedBooking.extra_fees || 0))}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-base pt-2 border-t">
                        <span>Total Amount:</span>
                        <span>{formatINR(Number(selectedBooking.total_amount || 0))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Payment Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Advance Paid:</span>
                        <span className="font-semibold text-green-600">
                          {formatINR(Number(selectedBooking.advance_paid || 0))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Balance Payment:</span>
                        <span className="font-semibold">
                          {formatINR(Math.max(Number(selectedBooking.total_amount || 0) - Number(selectedBooking.advance_paid || 0), 0))}
                        </span>
                      </div>
                      {selectedBooking.manual_reference && (
                        <div className="pt-2 border-t">
                          <span className="font-medium">Transaction ID:</span>{" "}
                          <span className="font-mono text-xs">{selectedBooking.manual_reference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MyBookings;


