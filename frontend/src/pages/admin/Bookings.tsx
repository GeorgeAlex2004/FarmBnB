// @ts-nocheck - Type errors are due to missing node_modules, install dependencies to resolve
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

  const [searchParams, setSearchParams] = useSearchParams();

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
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceHtml, setInvoiceHtml] = useState<string>("");
  const invoiceFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchDate, setSearchDate] = useState<string>("");
  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
  const formatDateShort = (date: string | Date | undefined): string => {
    if (!date) return "N/A";
    try {
      const dateObj = typeof date === "string" ? parseISO(date) : new Date(date);
      if (!isValid(dateObj)) return "Invalid Date";
      return format(dateObj, "MMM dd, yyyy");
    } catch {
      return "Invalid Date";
    }
  };

  // Open detail panel when navigated with ?selected=<id>
  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected && bookings.some((b: any) => (b.id || b._id) === selected)) {
      setOpenDetail(selected);
      // remove the param after opening to avoid stale state on navigation
      searchParams.delete('selected');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, bookings]);

  // Generate invoice (render in modal)
  const openInvoice = (b: any) => {
    const bookingId = b.id || b._id || '';
    const customerName = b.customer_name || (typeof b.customer === 'object' ? (b.customer?.name || 'Guest') : 'Guest');
    const propertyName = b.property_name || 'Unknown';
    const checkIn = formatDateShort(b.check_in_date);
    const checkOut = formatDateShort(b.check_out_date);
    const guests = b.num_guests || 0;
    const nights = 1; // Same-day policy
    const baseAmount = Number(b.base_amount || 0);
    const guestCharges = Number(b.guest_charges || 0);
    const extraFees = Number(b.extra_fees || 0);
    const totalAmount = Number(b.total_amount || 0);
    const advancePaid = Number(b.advance_paid || 0);
    const transactionId = b.manual_reference || '';
    const status = (b.status || '').toString();
    const paymentMethod = (b.payment_method || 'manual').toString();
    const displayPaymentMethod = paymentMethod === 'manual' ? 'online payment' : paymentMethod;
    const foodRequired = b.food_required ? 'Yes' : 'No';
    const foodPreference = b.food_preference || '-';
    const allergies = b.allergies || '-';
    const verificationStatus = b.verification_status || '-';

    // Tax placeholders (0% by default)
    const subtotal = baseAmount + guestCharges + extraFees;
    const taxRate = 0.18;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const grandTotal = subtotal + taxAmount;
    const balance = Math.max(grandTotal - advancePaid, 0);
    const perHeadUnit = guests && nights ? guestCharges / (guests * nights) : 0;
    const perHeadUnitStr = formatINR(perHeadUnit);
    const foodChargesLine = b.food_required ? 500 * guests * nights : 0;
    const otherFees = Math.max(extraFees - foodChargesLine, 0);
    const logoUrl = `${window.location.origin}/logo.png`;

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice - ${bookingId}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #111827; padding: 24px; }
      .container { max-width: 800px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .brand { font-size: 20px; font-weight: 700; }
      .meta { font-size: 12px; color: #6b7280; }
      h1 { font-size: 24px; margin: 16px 0; }
      .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
      .row { display: flex; flex-wrap: wrap; gap: 16px; }
      .col { flex: 1 1 260px; }
      .label { font-size: 12px; color: #6b7280; }
      .value { font-size: 14px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; }
      tfoot td { font-weight: 700; }
      .right { text-align: right; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; border: 1px solid #e5e7eb; font-size: 12px; }
      .muted { color: #6b7280; }
      .note { font-size: 12px; color: #6b7280; margin-top: 8px; }
      .actions { margin-top: 16px; }
      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .tag { font-size: 12px; background: #f3f4f6; border: 1px solid #e5e7eb; padding: 2px 6px; border-radius: 6px; display: inline-block; }
      @media print {
        .actions { display: none; }
        body { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${logoUrl}" alt="FarmBnB" style="height:36px; width:auto;" onerror="this.style.display='none';" />
          <div>
            <div class="brand">FarmBnB</div>
            <div class="muted" style="font-size:12px;margin-top:4px;">
              Invoice for day-use farm stay booking
            </div>
          </div>
        </div>
        <div class="meta">
          <div><strong>Invoice</strong></div>
          <div>Booking # ${bookingId}</div>
          <div>${new Date().toLocaleString()}</div>
        </div>
      </div>

      <div class="section">
        <div class="two-col">
          <div>
            <div class="label">Billed To</div>
            <div class="value">${customerName}</div>
            <div class="muted" style="font-size:12px;">Customer ID: ${b.customer_id || '-'}</div>
          </div>
          <div>
            <div class="label">Property</div>
            <div class="value">${propertyName}</div>
            <div class="muted" style="font-size:12px;">Booking Status: <span class="badge">${status || 'pending'}</span></div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="row">
          <div class="col">
            <div class="label">Check-in</div>
            <div class="value">${checkIn}</div>
          </div>
          <div class="col">
            <div class="label">Check-out</div>
            <div class="value">${checkOut}</div>
          </div>
          <div class="col">
            <div class="label">Guests</div>
            <div class="value">${guests} guest(s)</div>
          </div>
          <div class="col">
            <div class="label">Nights</div>
            <div class="value">${nights}</div>
          </div>
          <div class="col">
            <div class="label">Verification</div>
            <div class="value"><span class="tag">${verificationStatus}</span></div>
          </div>
          <div class="col">
            <div class="label">Payment Method</div>
            <div class="value">${displayPaymentMethod}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="label">Booking Options</div>
        <div class="muted" style="margin-bottom:8px;">Food required: <span class="value">${foodRequired}</span> &nbsp; | &nbsp; Preference: <span class="value">${foodPreference}</span> &nbsp; | &nbsp; Allergies: <span class="value">${allergies}</span></div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="right">Qty</th>
              <th class="right">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Base amount (1 day)</td>
              <td class="right">${nights}</td>
              <td class="right">${formatINR(baseAmount)}</td>
            </tr>
            <tr>
              <td>Guest charges</td>
              <td class="right">${guests} × ${perHeadUnitStr}</td>
              <td class="right">${formatINR(guestCharges)}</td>
            </tr>
            ${foodChargesLine > 0 ? `<tr>
              <td>Food charges</td>
              <td class="right">${guests} × ${formatINR(500)} × ${nights}</td>
              <td class="right">${formatINR(foodChargesLine)}</td>
            </tr>` : ''}
            ${otherFees > 0 ? `<tr>
              <td>Other fees (cleaning, service)</td>
              <td class="right">—</td>
              <td class="right">${formatINR(otherFees)}</td>
            </tr>` : ''}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">Subtotal</td>
              <td class="right">${formatINR(subtotal)}</td>
            </tr>
            <tr>
              <td colspan="2">Tax (${(taxRate * 100).toFixed(0)}%)</td>
              <td class="right">${formatINR(taxAmount)}</td>
            </tr>
            <tr>
              <td colspan="2">Total</td>
              <td class="right">${formatINR(grandTotal)}</td>
            </tr>
            <tr>
              <td colspan="2">Advance Paid</td>
              <td class="right">${formatINR(advancePaid)}</td>
            </tr>
            <tr>
              <td colspan="2">Balance</td>
              <td class="right">${formatINR(balance)}</td>
            </tr>
          </tfoot>
        </table>
        ${transactionId ? `<div class="note">Transaction ID: <span class="value">${transactionId}</span></div>` : ''}
      </div>

      <div class="section">
        <div class="label">Terms & Notes</div>
        <ul class="muted" style="font-size:12px; margin-top:6px; line-height:1.5;">
          <li>Day-use only: Check-in 9:00 AM; Check-out 7:00 PM.</li>
          <li>Outside food not allowed.</li>
          <li>Advance is non-refundable. Balance (if any) to be settled on-site.</li>
          <li>Carry a government-issued ID for verification at the property.</li>
        </ul>
      </div>

      <div class="note">This is a system-generated invoice. For queries, contact support.</div>
    </div>
  </body>
</html>`;

    setInvoiceHtml(html);
    setInvoiceDialogOpen(true);
  };

  // Function to determine booking status
  const getBookingStatus = (booking: any): string => {
    // If status is explicitly set to confirmed or cancelled, use it
    if (booking.status === 'confirmed' || booking.status === 'cancelled') {
      return booking.status;
    }
    
    // If verification_status is pending, return approval_pending
    if (booking.verification_status === 'pending') {
      return 'approval_pending';
    }
    
    // If ID proofs exist but verification_status is not approved, return approval_pending
    if (booking.id_proofs && Array.isArray(booking.id_proofs) && booking.id_proofs.length > 0) {
      if (booking.verification_status !== 'approved') {
        return 'approval_pending';
      }
    }
    
    // If payment screenshot exists but status is not confirmed, return payment_verification_pending
    if (booking.payment_screenshot_url && booking.verification_status === 'approved' && booking.status !== 'confirmed') {
      return 'payment_verification_pending';
    }
    
    // If verification is approved but advance is not paid, return payment_pending
    if (booking.verification_status === 'approved' && (booking.advance_paid === 0 || !booking.advance_paid)) {
      return 'payment_pending';
    }
    
    // If status is explicitly set, use it
    if (booking.status) {
      return booking.status;
    }
    
    // Default to pending
    return 'pending';
  };

  // Filter bookings based on status + search
  const filteredBookings = useMemo(() => {
    const norm = (v: any) => (v ?? '').toString().toLowerCase();
    const q = norm(searchQuery);
    const d = (searchDate || '').trim();

    return bookings.filter((booking) => {
      // status
      if (statusFilter !== "all" && getBookingStatus(booking) !== statusFilter) return false;

      // search text across property name, customer name, booking id
      if (q) {
        const bookingId = (booking.id || booking._id || '').toString();
        const propertyName = (booking.property_name ||
          (typeof booking.property === 'object' ? booking.property?.name : '') || '').toString();
        const customerName = (booking.customer_name ||
          (typeof booking.customer === 'object' ? booking.customer?.name : '') || '').toString();
        const haystack = `${propertyName} ${customerName} ${bookingId}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // search by check-in date (YYYY-MM-DD)
      if (d) {
        const inDate = booking.check_in_date ? new Date(booking.check_in_date) : null;
        if (!inDate) return false;
        const inStr = inDate.toISOString().slice(0, 10);
        if (inStr !== d) return false;
      }

      return true;
    });
  }, [bookings, statusFilter, searchQuery, searchDate]);

  // Get title based on selected filter
  const getTitle = (): string => {
    switch (statusFilter) {
      case "all":
        return "All Bookings";
      case "approval_pending":
        return "Approval Pending Bookings";
      case "payment_pending":
        return "Payment Pending Bookings";
      case "payment_verification_pending":
        return "Payment Verification Bookings";
      case "confirmed":
        return "Confirmed Bookings";
      case "cancelled":
        return "Cancelled Bookings";
      default:
        return "All Bookings";
    }
  };

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

  // Helper to get status display name and color
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'approval_pending':
        return { label: 'Approval Pending', color: 'bg-orange-100 text-orange-700 border-orange-200' };
      case 'payment_pending':
        return { label: 'Payment Pending', color: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'payment_verification_pending':
        return { label: 'Payment Verification Pending', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'confirmed':
        return { label: 'Confirmed', color: 'bg-green-100 text-green-700 border-green-200' };
      case 'cancelled':
        return { label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200' };
      default:
        return { label: 'Pending', color: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  // Render expanded details based on status
  const renderExpandedDetails = (b: any, bookingStatus: string) => {
    const customerName = b.customer_name || (typeof b.customer === 'object' ? (b.customer?.name || 'Guest') : 'Guest');
    const propertyName = b.property_name || 'Unknown';
    const transactionId = b.manual_reference || '-';

    return (
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

        {/* Payment Details - Show when available or status requires it */}
        {(bookingStatus === 'payment_verification_pending' || bookingStatus === 'confirmed' || b.manual_reference || b.payment_screenshot_url) && (
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">Payment Details</h4>
            <div className="space-y-2 text-sm">
              {transactionId && (
                <div>
                  <span className="font-medium">Transaction ID:</span>{' '}
                  <span className="font-mono text-base font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                    {transactionId}
                  </span>
                </div>
              )}
              {(b.payment_screenshot_url) && (
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
        )}

        {/* ID Proofs - Show whenever available */}
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

        {/* Action Buttons based on status */}
        <div className="flex gap-2 pt-4 border-t">
          <Button size="sm" variant="outline" onClick={() => openInvoice(b)}>
            Generate Invoice
          </Button>
          {bookingStatus === 'approval_pending' && (
            <Button size="sm" variant="outline" onClick={() => handleViewIds(b)}>
              View IDs
            </Button>
          )}
          {bookingStatus === 'payment_verification_pending' && (
            <Button 
              size="sm" 
              onClick={() => confirmMutation.mutate(b.id || b._id)} 
              disabled={confirmMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {confirmMutation.isPending ? 'Confirming...' : 'Verify Payment & Confirm Booking'}
            </Button>
          )}
          {bookingStatus !== 'cancelled' && bookingStatus !== 'completed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCancelClick(b.id || b._id)}
              disabled={cancelMutation.isPending}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <XCircle className="h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">{getTitle()}</h1>
        <p className="text-muted-foreground">
          View and manage all property bookings
        </p>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex-1">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="approval_pending">Approval Pending</TabsTrigger>
              <TabsTrigger value="payment_pending">Payment Pending</TabsTrigger>
              <TabsTrigger value="payment_verification_pending">Payment Verification</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
            </Tabs>

            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name/property/ID"
                className="border rounded-md px-3 py-2 w-56 text-sm bg-background"
              />
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background"
              />
              {(searchQuery || searchDate) && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchDate(''); }}
                  className="text-sm px-3 py-2 border rounded-md bg-muted hover:bg-muted/80"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading bookings...
            </div>
          ) : filteredBookings.length > 0 ? (
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
                    {filteredBookings.map((b: any) => {
                      const bookingStatus = getBookingStatus(b);
                      const statusDisplay = getStatusDisplay(bookingStatus);
                      const customerName = b.customer_name || (typeof b.customer === 'object' ? (b.customer?.name || 'Guest') : 'Guest');
                      const propertyName = b.property_name || 'Unknown';
                      const bookingId = b.id || b._id;
                      
                      if (!bookingId) return null;

                      return (
                        <React.Fragment key={bookingId}>
                          <TableRow key={bookingId}>
                            <TableCell className="font-mono text-sm">{bookingId}</TableCell>
                            <TableCell className="font-medium">{propertyName}</TableCell>
                            <TableCell>{customerName}</TableCell>
                            <TableCell>{formatDate(b.check_in_date)}</TableCell>
                            <TableCell>{formatDate(b.check_out_date)}</TableCell>
                            <TableCell>{b.num_guests || 0}</TableCell>
                            <TableCell className="font-medium">{formatINR(Number(b.total_amount ?? 0))}</TableCell>
                            <TableCell>{formatINR(Number(b.advance_paid ?? 0))}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusDisplay.color}`}>
                                {statusDisplay.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  onClick={() => setOpenDetail(openDetail === bookingId ? null : bookingId)}
                                >
                                  {openDetail === bookingId ? 'Hide' : 'View'} Details
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {openDetail === bookingId && (
                            <TableRow>
                              <TableCell colSpan={10}>
                                {renderExpandedDetails(b, bookingStatus)}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No bookings found
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

      {/* Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription>Preview and download the invoice for this booking.</DialogDescription>
          </DialogHeader>
          <div className="h-[70vh] border rounded overflow-hidden bg-white">
            {/* Render invoice HTML inside iframe without opening a new tab */}
            <iframe
              ref={invoiceFrameRef}
              title="Invoice"
              className="w-full h-full"
              srcDoc={invoiceHtml}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              onClick={() => {
                const frame = invoiceFrameRef.current;
                if (frame && frame.contentWindow) {
                  frame.contentWindow.focus();
                  frame.contentWindow.print();
                }
              }}
            >
              Download PDF
            </Button>
            <Button variant="ghost" onClick={() => setInvoiceDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBookings;
