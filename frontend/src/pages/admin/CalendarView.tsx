import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, eachDayOfInterval } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

const CalendarView = () => {
  const queryClient = useQueryClient();
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [blackoutDialogOpen, setBlackoutDialogOpen] = useState(false);
  const [blackoutReason, setBlackoutReason] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch all properties
  const { data: propertiesResponse } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => api.getProperties({}),
  });

  const properties = propertiesResponse?.data || [];

  // Auto-select property if there's only one
  useEffect(() => {
    if (properties.length === 1 && !selectedProperty) {
      const singleProperty = properties[0];
      const propertyId = singleProperty.id || singleProperty._id;
      if (propertyId) {
        setSelectedProperty(propertyId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  // Fetch all bookings
  const { data: bookingsResponse } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => api.getBookings({}),
  });

  const bookings = bookingsResponse?.data || [];

  // Fetch all blackouts for selected property
  const { data: blackoutsResponse } = useQuery({
    queryKey: ["property-blackouts", selectedProperty],
    queryFn: async () => {
      if (!selectedProperty) {
        return { success: true, data: [] };
      }
      return api.getPropertyBlackouts(selectedProperty);
    },
    enabled: !!selectedProperty,
  });

  const blackouts = blackoutsResponse?.data || [];

  // Process dates for calendar display
  const dateStatusMap = useMemo(() => {
    const map = new Map<string, { type: 'booked' | 'blackout' | 'available'; propertyName?: string; bookingId?: string }>();
    
    // Add booked dates (only confirmed bookings)
    bookings
      .filter((booking: any) => booking.status === 'confirmed')
      .forEach((booking: any) => {
        if (!selectedProperty || booking.property_id !== selectedProperty) return;
        
        const propertyName = booking.property_name || 'Unknown';
        const checkIn = new Date(booking.check_in_date || booking.checkIn);
        const checkOut = new Date(booking.check_out_date || booking.checkOut);
        
        // Add all dates in the booking range
        const current = new Date(checkIn);
        while (current <= checkOut) {
          const dateKey = format(current, 'yyyy-MM-dd');
          map.set(dateKey, {
            type: 'booked',
            propertyName,
            bookingId: booking.id || booking._id,
          });
          current.setDate(current.getDate() + 1);
        }
      });
    
    // Add blackout dates
    blackouts.forEach((blackout: any) => {
      if (!selectedProperty || blackout.property_id !== selectedProperty) return;
      
      const dateKey = format(new Date(blackout.date), 'yyyy-MM-dd');
      const propertyName = blackout.properties?.name || 
        properties.find((p: any) => (p.id || p._id) === blackout.property_id)?.name || 
        'Unknown';
      
      // Blackouts override bookings
      map.set(dateKey, {
        type: 'blackout',
        propertyName,
      });
    });
    
    return map;
  }, [bookings, blackouts, selectedProperty, properties]);

  // Add blackout mutation
  const addBlackoutMutation = useMutation({
    mutationFn: async ({ propertyId, dates, reason }: { propertyId: string; dates: string[]; reason?: string }) => {
      return api.addPropertyBlackouts(propertyId, dates, reason);
    },
    onSuccess: () => {
      toast.success("Dates blacked out successfully");
      queryClient.invalidateQueries({ queryKey: ["property-blackouts"] });
      setBlackoutDialogOpen(false);
      setBlackoutReason("");
      setDateRange(undefined);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add blackout");
    },
  });

  // Remove blackout mutation
  const removeBlackoutMutation = useMutation({
    mutationFn: async ({ propertyId, dates }: { propertyId: string; dates: string[] }) => {
      return api.removePropertyBlackouts(propertyId, dates);
    },
    onSuccess: () => {
      toast.success("Blackouts removed successfully");
      queryClient.invalidateQueries({ queryKey: ["property-blackouts"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove blackouts");
    },
  });

  // Check if a date range has any confirmed bookings
  const hasConfirmedBookings = (from: Date, to: Date): boolean => {
    const rangeDates = eachDayOfInterval({ start: from, end: to });
    return rangeDates.some(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const status = dateStatusMap.get(dateKey);
      return status?.type === 'booked';
    });
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (!range) {
      setDateRange(undefined);
      return;
    }

    setDateRange(range);

    // If both dates are selected, check for bookings and open dialog
    if (range.from && range.to) {
      if (!selectedProperty) {
        toast.error("Please select a property to add blackouts");
        setDateRange(undefined);
        return;
      }

      // Check if any dates in the range have confirmed bookings
      if (hasConfirmedBookings(range.from, range.to)) {
        toast.error("Cannot blackout dates with confirmed bookings");
        setDateRange(undefined);
        return;
      }

      // Check if all dates are already blacked out
      const rangeDates = eachDayOfInterval({ start: range.from, end: range.to });
      const allBlackedOut = rangeDates.every(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const status = dateStatusMap.get(dateKey);
        return status?.type === 'blackout';
      });

      if (allBlackedOut) {
        // Remove blackouts for all dates in range
        if (confirm(`Remove blackouts for ${rangeDates.length} date(s)?`)) {
          const dates = rangeDates.map(d => format(d, 'yyyy-MM-dd'));
          removeBlackoutMutation.mutate({
            propertyId: selectedProperty,
            dates,
          });
          setDateRange(undefined);
        }
      } else {
        // Open dialog to add blackout
        setBlackoutDialogOpen(true);
      }
    }
  };

  const handleAddBlackout = () => {
    if (!dateRange?.from || !dateRange?.to || !selectedProperty) return;
    
    // Generate all dates in the range
    const dates = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));
    
    addBlackoutMutation.mutate({
      propertyId: selectedProperty,
      dates: dateStrings,
      reason: blackoutReason.trim() || undefined,
    });
  };

  // Get dates for modifiers
  const bookedDates = useMemo(() => {
    return Array.from(dateStatusMap.entries())
      .filter(([_, status]) => status.type === 'booked')
      .map(([dateKey]) => new Date(dateKey));
  }, [dateStatusMap]);

  const blackoutDates = useMemo(() => {
    return Array.from(dateStatusMap.entries())
      .filter(([_, status]) => status.type === 'blackout')
      .map(([dateKey]) => new Date(dateKey));
  }, [dateStatusMap]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Calendar View</h1>
        <p className="text-muted-foreground">
          View bookings and manage blackout dates
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Availability Calendar</CardTitle>
            {properties.length > 1 && (
              <div className="flex items-center gap-4">
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((prop: any) => (
                      <SelectItem key={prop.id || prop._id} value={prop.id || prop._id}>
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {properties.length === 1 && selectedProperty && (
              <div className="text-sm text-muted-foreground">
                {properties[0]?.name || 'Property'}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedProperty && properties.length > 1 ? (
            <div className="text-center py-12 text-muted-foreground">
              Please select a property to view its calendar
            </div>
          ) : !selectedProperty && properties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No properties available
            </div>
          ) : (
            <div className="space-y-6">
              {/* Legend */}
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                  <span className="text-sm">Booked (Confirmed)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                  <span className="text-sm">Blacked Out</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
                  <span className="text-sm">Available</span>
                </div>
              </div>

              {/* Calendar */}
              <div className="flex justify-center">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleDateRangeSelect}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="rounded-md border w-fit"
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  modifiers={{
                    booked: bookedDates,
                    blackout: blackoutDates,
                  }}
                  modifiersClassNames={{
                    booked: "bg-red-100 text-red-700 hover:bg-red-200 font-semibold border border-red-300",
                    blackout: "bg-orange-100 text-orange-700 hover:bg-orange-200 font-semibold border border-orange-300",
                  }}
                />
              </div>

              {/* Instructions */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">How to use:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Select a date range on <span className="font-medium text-gray-700">available dates</span> to black out multiple dates at once</li>
                  <li>Select a date range on <span className="font-medium text-orange-700">blacked out dates</span> to remove blackouts for multiple dates</li>
                  <li>You cannot blackout dates that have <span className="font-medium text-red-700">confirmed bookings</span></li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blackout Dialog */}
      <Dialog open={blackoutDialogOpen} onOpenChange={setBlackoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blackout Dates</DialogTitle>
            <DialogDescription>
              Block these dates from being booked
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Date Range</Label>
              <Input
                value={
                  dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
                    : dateRange?.from
                    ? format(dateRange.from, 'MMM dd, yyyy')
                    : ''
                }
                disabled
              />
              {dateRange?.from && dateRange?.to && (
                <p className="text-sm text-muted-foreground mt-1">
                  {Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} day(s) will be blacked out
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={blackoutReason}
                onChange={(e) => setBlackoutReason(e.target.value)}
                placeholder="e.g., Maintenance, Holiday, etc."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBlackoutDialogOpen(false);
                setBlackoutReason("");
                setDateRange(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddBlackout}
              disabled={addBlackoutMutation.isPending || !dateRange?.from || !dateRange?.to}
            >
              {addBlackoutMutation.isPending ? "Adding..." : "Add Blackout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;

