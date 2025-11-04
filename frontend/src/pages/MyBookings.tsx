import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";

const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

// Calculate advance amount (50% of total) with same rounding as backend
const calculateAdvance = (total: number) => Math.round(total * 0.5 * 100) / 100;

const MyBookings = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const res = await api.getBookings({ limit: 100 });
      return res.data || [];
    }
  });

  const { upcoming, past, pendingApproval, pendingPayment, cancelled } = useMemo(() => {
    const now = new Date();
    const list = Array.isArray(data) ? data : [];
    const withDates = list.map((b: any) => ({
      ...b,
      _checkIn: new Date(b.check_in_date || b.checkIn),
      _checkOut: new Date(b.check_out_date || b.checkOut),
    }));
    // Filter bookings by status - exclude pending approval and pending payment from upcoming/past
    const pendingApproval = withDates.filter(b => (b.verification_status || 'pending') === 'pending');
    const pendingPayment = withDates.filter(b => (b.verification_status || 'pending') === 'approved' && (b.status || 'pending') === 'pending');
    
    // Upcoming: confirmed bookings with check-out date in future, exclude pending approval/payment and cancelled
    const upcoming = withDates
      .filter(b => {
        const status = (b.status || '').toLowerCase();
        const isPendingApproval = (b.verification_status || 'pending') === 'pending';
        const isPendingPayment = (b.verification_status || 'pending') === 'approved' && status === 'pending';
        const isCancelled = status === 'cancelled';
        return b._checkOut >= now && !isPendingApproval && !isPendingPayment && !isCancelled && status === 'confirmed';
      })
      .sort((a,b) => a._checkIn.getTime() - b._checkIn.getTime());
    
    // Past: bookings with check-out date in past, exclude pending approval/payment
    const past = withDates
      .filter(b => {
        const isPendingApproval = (b.verification_status || 'pending') === 'pending';
        const isPendingPayment = (b.verification_status || 'pending') === 'approved' && (b.status || 'pending') === 'pending';
        return b._checkOut < now && !isPendingApproval && !isPendingPayment;
      })
      .sort((a,b) => b._checkOut.getTime() - a._checkOut.getTime());
    
    // Cancelled: separate section for cancelled bookings
    const cancelled = withDates
      .filter(b => (b.status || '').toLowerCase() === 'cancelled')
      .sort((a,b) => b._checkOut.getTime() - a._checkOut.getTime());
    
    return { upcoming, past, pendingApproval, pendingPayment, cancelled };
  }, [data]);

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
          <div>
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-3">Pending Approval</h2>
              {pendingApproval.length === 0 ? (
                <Card className="p-6 text-muted-foreground">No bookings awaiting ID verification.</Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pendingApproval.map((b: any) => (
                    <Card key={b.id || b._id} className="shadow-soft">
                      <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg line-clamp-1">{b.property?.name || b.property_name || 'Property'}</h3>
                          <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 capitalize">pending approval</span>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{(b.check_in_date || '').toString()} → {(b.check_out_date || '').toString()}</span>
                        </div>
                        <div className="pt-2 flex items-center justify-between">
                          <div className="text-sm">
                            <div>Total: <span className="font-semibold">{formatINR(Number(b.total_amount ?? 0))}</span></div>
                            <div className="text-xs text-muted-foreground">Advance to pay: {formatINR(calculateAdvance(Number(b.total_amount ?? 0)))}</div>
                          </div>
                          <Link to={`/bookings/${b.id || b._id}/id-proof`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
            
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-3">Pending Payment</h2>
              {pendingPayment.length === 0 ? (
                <Card className="p-6 text-muted-foreground">No bookings awaiting payment.</Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pendingPayment.map((b: any) => (
                    <Card key={b.id || b._id} className="shadow-soft">
                      <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg line-clamp-1">{b.property?.name || b.property_name || 'Property'}</h3>
                          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 capitalize">pending payment</span>
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
                        <div className="pt-2 flex items-center justify-between">
                          <div className="text-sm">
                            <div>Total: <span className="font-semibold">{formatINR(Number(b.total_amount ?? 0))}</span></div>
                            <div className="text-xs text-muted-foreground">Advance to pay: {formatINR(calculateAdvance(Number(b.total_amount ?? 0)))}</div>
                          </div>
                          <Link to={`/payments/${b.id || b._id}`}>
                            <Button size="sm">Pay Now</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <Card className="p-6 text-muted-foreground">No upcoming bookings.</Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {upcoming.map((b: any) => (
                    <Card key={b.id || b._id} className="shadow-soft">
                      <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg line-clamp-1">{b.property?.name || b.property_name || 'Property'}</h3>
                          <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary capitalize">{b.status}</span>
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
                        {b.property?.location && (
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="line-clamp-1">{b.property.location?.address || b.property.location}</span>
                          </div>
                        )}
                        <div className="pt-2 flex items-center justify-between">
                          <div className="text-sm">
                            <div>Total: <span className="font-semibold">{formatINR(Number(b.total_amount ?? 0))}</span></div>
                            <div className="text-xs text-muted-foreground">Advance: {formatINR(Number(b.advance_paid ?? 0))}</div>
                          </div>
                          <div className="flex gap-2">
                            <Link to={`/properties/${b.property_id || b.property?._id || b.property?.id || ''}`}>
                              <Button variant="outline" size="sm">View</Button>
                            </Link>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => api.cancelBooking(b.id || b._id).then(() => location.reload())}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-3">Cancelled</h2>
              {cancelled.length === 0 ? (
                <Card className="p-6 text-muted-foreground">No cancelled bookings.</Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {cancelled.map((b: any) => (
                    <Card key={b.id || b._id} className="shadow-soft opacity-75">
                      <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg line-clamp-1">{b.property?.name || b.property_name || 'Property'}</h3>
                          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 capitalize">cancelled</span>
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
                        <div className="pt-2 flex items-center justify-between">
                          <div className="text-sm">
                            <div>Total: <span className="font-semibold">{formatINR(Number(b.total_amount ?? 0))}</span></div>
                            <div className="text-xs text-muted-foreground">Advance: {formatINR(Number(b.advance_paid ?? 0))}</div>
                          </div>
                          <Link to={`/properties/${b.property_id || b.property?._id || b.property?.id || ''}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Past</h2>
              {past.length === 0 ? (
                <Card className="p-6 text-muted-foreground">No past bookings.</Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {past.map((b: any) => (
                    <Card key={b.id || b._id} className="shadow-soft">
                      <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg line-clamp-1">{b.property?.name || b.property_name || 'Property'}</h3>
                          <span className="text-xs px-2 py-1 rounded bg-muted text-foreground/70 capitalize">{b.status}</span>
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
                        <div className="pt-2 flex items-center justify-between">
                          <div className="text-sm">
                            <div>Total: <span className="font-semibold">{formatINR(Number(b.total_amount ?? 0))}</span></div>
                          </div>
                          <Link to={`/properties/${b.property_id || b.property?._id || b.property?.id || ''}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;


