// @ts-nocheck - Type errors are due to missing node_modules, install dependencies to resolve
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Booking {
  _id?: string;
  id?: string;
  bookingNumber?: string;
  booking_number?: string;
  property?: {
    name?: string;
    _id?: string;
  } | string;
  customer?: {
    name?: string;
    email?: string;
    _id?: string;
  } | string;
  checkIn?: string | Date;
  checkOut?: string | Date;
  check_in_date?: string | Date;
  check_out_date?: string | Date;
  numberOfGuests?: number;
  num_guests?: number;
  pricing?: {
    totalAmount?: number;
  };
  payment?: {
    advancePaid?: number;
  };
  total_amount?: number;
  advance_paid?: number;
  status?: string;
}

interface BookingsResponse {
  success: boolean;
  data: Booking[];
  total?: number;
  page?: number;
  pages?: number;
}

const AdminBookings = (): JSX.Element => {
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState<boolean>(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");

  const { data: bookingsResponse, isLoading } = useQuery<BookingsResponse>({
    queryKey: ["admin-bookings"],
    queryFn: () => api.getBookings({}),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.confirmBooking(id),
    onSuccess: () => {
      toast.success("Booking confirmed");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to confirm booking";
      toast.error(errorMessage);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.cancelBooking(id, reason),
    onSuccess: () => {
      toast.success("Booking cancelled");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setCancelDialogOpen(false);
      setCancelReason("");
      setSelectedBooking(null);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel booking";
      toast.error(errorMessage);
    },
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

  const getStatusColor = (status: string | undefined): string => {
    if (!status) return "bg-gray-100 text-gray-700 border-gray-200";
    
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-700 border-green-200";
      case "pending":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-200";
      case "completed":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const handleCancelClick = (bookingId: string): void => {
    setSelectedBooking(bookingId);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = (): void => {
    if (selectedBooking) {
      cancelMutation.mutate({
        id: selectedBooking,
        reason: cancelReason.trim() || undefined,
      });
    }
  };

  const bookings: Booking[] = bookingsResponse?.data || [];
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openPendingDetail, setOpenPendingDetail] = useState<string | null>(null);
  const [idProofDialogOpen, setIdProofDialogOpen] = useState(false);
  const [selectedBookingForIds, setSelectedBookingForIds] = useState<any>(null);
  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => api.verifyBooking(id, status),
    onSuccess: () => {
      toast.success(`Booking ${selectedBookingForIds?.verification_status === 'approved' ? 'approved' : 'status updated'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      setIdProofDialogOpen(false);
      setSelectedBookingForIds(null);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update booking';
      toast.error(errorMessage);
    },
  });

  const handleViewIds = (booking: any) => {
    setSelectedBookingForIds(booking);
    setIdProofDialogOpen(true);
  };

  const handleVerify = (status: 'approved' | 'rejected') => {
    if (selectedBookingForIds) {
      verifyMutation.mutate({ id: selectedBookingForIds.id || selectedBookingForIds._id, status });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Bookings</h1>
        <p className="text-muted-foreground">
          View and manage all property bookings
        </p>
      </div>

      <Card className="shadow-soft mb-6">
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bookings || []).filter((b: any) => (b.verification_status || 'pending') === 'pending').map((b: any) => (
                    <TableRow key={b.id || b._id}>
                      <TableCell className="font-mono text-sm">{b.id || b._id}</TableCell>
                      <TableCell>{typeof b.customer === 'object' ? (b.customer?.name || 'Guest') : 'Guest'}</TableCell>
                      <TableCell>{(b.check_in_date || '').toString()}</TableCell>
                      <TableCell><span className="text-orange-600 text-xs px-2 py-1 bg-orange-100 rounded-full">Pending</span></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewIds(b)}>View IDs</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft mb-6">
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Advance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bookings || [])
                    .map((b: any) => ({
                      ...b,
                      _out: new Date(b.check_out_date || b.checkOut || 0)
                    }))
                    .filter((b: any) => (b.verification_status || '') === 'approved' && (b.status || '') === 'confirmed' && b._out >= new Date())
                    .map((booking: any) => {
                      const propertyName = booking.property_name || booking.property?.name || 'Unknown';
                      const customerName = booking.customer_name || booking.customer?.name || 'Guest';
                      const customerEmail = booking.customer?.email || '';
                      // Use only the fields that backend stores - total_amount and advance_paid
                      const totalAmount = Number(booking.total_amount ?? 0);
                      const advancePaid = Number(booking.advance_paid ?? 0);
                      const bookingId = booking._id || booking.id || '';
                      if (!bookingId) return null;
                      return (
                        <TableRow key={bookingId}>
                          <TableCell className="font-mono text-sm">{bookingId}</TableCell>
                          <TableCell className="font-medium">{propertyName}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{customerName}</div>
                              {customerEmail && <div className="text-xs text-muted-foreground">{customerEmail}</div>}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(booking.check_in_date || booking.checkIn)}</TableCell>
                          <TableCell>{formatDate(booking.check_out_date || booking.checkOut)}</TableCell>
                          <TableCell>{booking.num_guests || booking.numberOfGuests || 0}</TableCell>
                          <TableCell className="font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}</TableCell>
                          <TableCell>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(advancePaid)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>{booking.status}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft mb-6">
        <CardHeader>
          <CardTitle>Cancelled Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Advance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bookings || [])
                    .filter((b: any) => (b.verification_status || '') === 'approved' && (b.status || '') === 'cancelled')
                    .map((booking: any) => {
                      const propertyName = booking.property_name || booking.property?.name || 'Unknown';
                      const customerName = booking.customer_name || booking.customer?.name || 'Guest';
                      const customerEmail = booking.customer?.email || '';
                      // Use only the fields that backend stores - total_amount and advance_paid
                      const totalAmount = Number(booking.total_amount ?? 0);
                      const advancePaid = Number(booking.advance_paid ?? 0);
                      const bookingId = booking._id || booking.id || '';
                      if (!bookingId) return null;
                      return (
                        <TableRow key={bookingId}>
                          <TableCell className="font-mono text-sm">{bookingId}</TableCell>
                          <TableCell className="font-medium">{propertyName}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{customerName}</div>
                              {customerEmail && <div className="text-xs text-muted-foreground">{customerEmail}</div>}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(booking.check_in_date || booking.checkIn)}</TableCell>
                          <TableCell>{formatDate(booking.check_out_date || booking.checkOut)}</TableCell>
                          <TableCell>{booking.num_guests || booking.numberOfGuests || 0}</TableCell>
                          <TableCell className="font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}</TableCell>
                          <TableCell>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(advancePaid)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>{booking.status}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft mb-6">
        <CardHeader>
          <CardTitle>Payment Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Advance Paid</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bookings || [])
                    .filter((b: any) => 
                      (b.verification_status || '') === 'approved' && 
                      (b.status || '') === 'pending' &&
                      (b.manual_reference || '').trim() !== '' &&
                      (b.payment_screenshot_url || '').trim() !== ''
                    )
                    .map((b: any) => {
                      const customerName = b.customer_name || (typeof b.customer === 'object' ? (b.customer?.name || 'Guest') : 'Guest');
                      const propertyName = b.property_name || 'Unknown';
                      const transactionId = b.manual_reference || '-';
                      const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
                      return (
                      <>
                      <TableRow key={(b.id || b._id) + '-row'}>
                        <TableCell className="font-mono text-sm">{b.id || b._id}</TableCell>
                        <TableCell className="font-medium">{customerName}</TableCell>
                        <TableCell>{propertyName}</TableCell>
                        <TableCell>{formatDate(b.check_in_date)}</TableCell>
                        <TableCell>
                          {formatINR(Number(b.total_amount ?? 0))}
                        </TableCell>
                        <TableCell>
                          {formatINR(Number(b.advance_paid ?? 0))}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm font-semibold text-green-700">
                            {transactionId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              onClick={() => setOpenPendingDetail(openPendingDetail === (b.id || b._id) ? null : (b.id || b._id))}
                            >
                              {openPendingDetail === (b.id || b._id) ? 'Hide' : 'View'} Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {openPendingDetail === (b.id || b._id) && (
                        <TableRow key={(b.id || b._id) + '-detail'}>
                          <TableCell colSpan={8}>
                            <div className="p-6 bg-muted/40 rounded-md space-y-4">
                              {/* Basic Booking Details */}
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="font-medium">Customer:</span> {customerName}</div>
                                <div><span className="font-medium">Property:</span> {propertyName}</div>
                                <div><span className="font-medium">Check-in:</span> {formatDate(b.check_in_date)}</div>
                                <div><span className="font-medium">Check-out:</span> {formatDate(b.check_out_date)}</div>
                                <div><span className="font-medium">Guests:</span> {b.num_guests || 0}</div>
                                <div><span className="font-medium">Food Required:</span> {b.food_required ? 'Yes' : 'No'}</div>
                                {b.food_preference && (
                                  <div><span className="font-medium">Food Preference:</span> {b.food_preference}</div>
                                )}
                                {b.allergies && (
                                  <div><span className="font-medium">Allergies:</span> {b.allergies}</div>
                                )}
                              </div>

                              {/* Cost Breakdown */}
                              <div className="border-t pt-4">
                                <h4 className="font-semibold mb-3">Cost Breakdown</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span>Base amount (1 day):</span>
                                    <span>{formatINR(Number(b.base_amount || 0))}</span>
                                  </div>
                                  {Number(b.guest_charges || 0) > 0 && (
                                    <div className="flex justify-between">
                                      <span>Guest charges ({b.num_guests || 0} guests):</span>
                                      <span>{formatINR(Number(b.guest_charges || 0))}</span>
                                    </div>
                                  )}
                                  {Number(b.extra_fees || 0) > 0 && (
                                    <div className="flex justify-between">
                                      <span>Extra fees (food, cleaning, service):</span>
                                      <span>{formatINR(Number(b.extra_fees || 0))}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-semibold text-base pt-2 border-t">
                                    <span>Total Amount:</span>
                                    <span>{formatINR(Number(b.total_amount || 0))}</span>
                                  </div>
                                  <div className="flex justify-between text-sm pt-1">
                                    <span>Advance Paid (50%):</span>
                                    <span className="font-semibold text-primary">{formatINR(Number(b.advance_paid || 0))}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Payment Details */}
                              <div className="border-t pt-4">
                                <h4 className="font-semibold mb-3">Payment Details</h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="font-medium">Transaction ID:</span>{' '}
                                    <span className="font-mono text-base font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                                      {transactionId}
                                    </span>
                                  </div>
                                  {b.payment_screenshot_url && (
                                    <div>
                                      <span className="font-medium mb-2 block">Payment Screenshot:</span>
                                      <div className="border rounded-lg overflow-hidden max-w-md">
                                        <img 
                                          src={b.payment_screenshot_url} 
                                          alt="Payment screenshot" 
                                          className="w-full h-auto max-h-96 object-contain bg-muted"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                                          }}
                                        />
                                        <div className="p-2 bg-muted border-t">
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={() => window.open(b.payment_screenshot_url, '_blank')}
                                          >
                                            Open Full Size
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* ID Proofs */}
                              {b.id_proofs && Array.isArray(b.id_proofs) && b.id_proofs.length > 0 && (
                                <div className="border-t pt-4">
                                  <h4 className="font-semibold mb-3">ID Proofs</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {b.id_proofs.map((proofUrl: string, index: number) => (
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

                              {/* Action Button */}
                              <div className="flex gap-2 pt-4 border-t">
                                <Button 
                                  size="sm" 
                                  onClick={() => confirmMutation.mutate(b.id || b._id)} 
                                  disabled={confirmMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {confirmMutation.isPending ? 'Confirming...' : 'Verify Payment & Confirm Booking'}
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </>
                    )})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading bookings...
            </div>
          ) : bookings.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Advance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings
                    .filter((b: any) => (b.verification_status || '') === 'approved' && (b.status || '') === 'confirmed')
                    .map((booking: Booking) => {
                    const property = booking.property;
                    const customer = booking.customer;
                    const propertyName = (booking as any).property_name || (typeof property === 'object' && property !== null ? (property as any).name : '') || 'Unknown';
                    const customerName = (booking as any).customer_name || (typeof customer === 'object' && customer !== null ? (customer as any).name : '') || 'Guest';
                    const customerEmail =
                      typeof customer === "object" && customer !== null
                        ? customer.email || ""
                        : "";
                    // Use only the fields that backend stores - total_amount and advance_paid
                    const totalAmount = Number((booking as any).total_amount ?? 0);
                    const advancePaid = Number((booking as any).advance_paid ?? 0);
                    const checkInDate = (booking as any).check_in_date ?? (booking as any).checkIn;
                    const checkOutDate = (booking as any).check_out_date ?? (booking as any).checkOut;
                    const bookingId = booking._id || booking.id || "";

                    if (!bookingId) return null;

                    return (
                      <TableRow key={bookingId}>
                        <TableCell className="font-mono text-sm">
                          {booking.bookingNumber || booking.booking_number || booking.id || booking._id || "N/A"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {propertyName}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{customerName}</div>
                            {customerEmail && (
                              <div className="text-xs text-muted-foreground">
                                {customerEmail}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(checkInDate)}</TableCell>
                        <TableCell>{formatDate(checkOutDate)}</TableCell>
                        <TableCell>
                          {booking.numberOfGuests || booking.num_guests || 0}
                        </TableCell>
                        <TableCell className="font-medium">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(advancePaid)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                              booking.status
                            )}`}
                          >
                            {booking.status || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {booking.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  confirmMutation.mutate(bookingId)
                                }
                                disabled={confirmMutation.isPending}
                                className="gap-1"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Confirm
                              </Button>
                            )}
                            {booking.status !== "cancelled" &&
                              booking.status !== "completed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelClick(bookingId)}
                                  disabled={cancelMutation.isPending}
                                  className="gap-1 text-destructive hover:text-destructive"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Cancel
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No bookings yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* ID Proofs Dialog */}
      <Dialog open={idProofDialogOpen} onOpenChange={setIdProofDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View ID Proofs - Booking #{selectedBookingForIds?.id || selectedBookingForIds?._id || 'N/A'}</DialogTitle>
            <DialogDescription>
              Review the uploaded ID proofs before approving or rejecting the booking.
            </DialogDescription>
          </DialogHeader>
          {selectedBookingForIds && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedBookingForIds.id_proofs && Array.isArray(selectedBookingForIds.id_proofs) && selectedBookingForIds.id_proofs.length > 0 ? (
                  selectedBookingForIds.id_proofs.map((proofUrl: string, index: number) => (
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
                            className="w-full h-auto max-h-96 object-contain bg-muted"
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
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    No ID proofs uploaded yet
                  </div>
                )}
              </div>
              
              <div className="border-t pt-4 space-y-2">
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Customer:</span> {selectedBookingForIds.customer_name || (typeof selectedBookingForIds.customer === 'object' ? (selectedBookingForIds.customer?.name || 'Guest') : 'Guest')}</div>
                  <div><span className="font-medium">Property:</span> {selectedBookingForIds.property_name || 'Unknown'}</div>
                  <div><span className="font-medium">Date:</span> {selectedBookingForIds.check_in_date || 'N/A'}</div>
                  <div><span className="font-medium">Guests:</span> {selectedBookingForIds.num_guests || 0}</div>
                  <div><span className="font-medium">Total:</span> {formatINR(Number(selectedBookingForIds.total_amount || 0))}</div>
                  <div><span className="font-medium">ID Proofs Uploaded:</span> {selectedBookingForIds.id_proofs?.length || 0}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIdProofDialogOpen(false);
                setSelectedBookingForIds(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleVerify('rejected')}
              disabled={verifyMutation.isPending}
            >
              Reject
            </Button>
            <Button
              onClick={() => handleVerify('approved')}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Cancellation Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for cancellation..."
                value={cancelReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setCancelReason(e.target.value)
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                setCancelReason("");
                setSelectedBooking(null);
              }}
              disabled={cancelMutation.isPending}
            >
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBookings;
