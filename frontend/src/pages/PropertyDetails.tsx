import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Users, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Wifi, Car, UtensilsCrossed, Waves, Dog, Snowflake, Flame, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";

const facilityIcons: Record<string, any> = {
  'WiFi': Wifi,
  'Parking': Car,
  'Kitchen': UtensilsCrossed,
  'Pool': Waves,
  'Pet-friendly': Dog,
  'Air Conditioning': Snowflake,
  'Heating': Flame,
};

const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [numGuests, setNumGuests] = useState(2);
  const [foodPreference, setFoodPreference] = useState<'all-veg' | 'all-non-veg' | 'both' | ''>('');
  const [vegGuests, setVegGuests] = useState<number>(0);
  const [nonVegGuests, setNonVegGuests] = useState<number>(0);
  const [allergies, setAllergies] = useState('');
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);

  const { data: propertyResponse, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      if (!id) throw new Error("Property ID required");
      const response = await api.getProperty(id);
      return response.data;
    },
    enabled: !!id,
  });

  const property = propertyResponse;
  const images = property?.images?.map((img: any) => 
    typeof img === 'string' ? img : (img.url || img)
  ) || [];
  const videos: string[] = Array.isArray(property?.videos) ? property.videos : [];
  const media: Array<{ type: 'image' | 'video'; url: string }> = [
    ...images.map((u: string) => ({ type: 'image' as const, url: u })),
    ...videos.map((u: string) => ({ type: 'video' as const, url: u })),
  ];

  // Fetch reviews for this property
  const { data: reviewsResponse } = useQuery({
    queryKey: ["property-reviews", id],
    queryFn: async () => {
      if (!id) return { success: true, data: [] };
      return api.getPropertyReviews(id);
    },
    enabled: !!id,
  });

  const reviews = reviewsResponse?.data || [];
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
    : 0;

  // Fetch unavailable dates (bookings + blackouts) for calendar
  const { data: unavailableDatesData } = useQuery({
    queryKey: ["unavailable-dates", id],
    queryFn: async () => {
      if (!id) return { bookings: [], blackouts: [] };
      
      // Fetch ALL bookings for this property (we'll filter blocking bookings in JS)
      const { data: allBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('check_in_date, check_out_date, status, verification_status, payment_screenshot_url, manual_reference, advance_paid, property_id')
        .eq('property_id', id);
      
      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
      }
      
      // Filter to bookings that should block dates:
      // 1. Status is explicitly 'confirmed', OR
      // 2. Verification is approved AND payment has been made (payment_screenshot_url, manual_reference, or advance_paid > 0)
      // This prevents double-booking once customer has paid, even if admin hasn't explicitly confirmed yet
      const blockingBookings = (allBookings || []).filter((b: any) => {
        const status = (b.status || '').toLowerCase();
        const verificationStatus = (b.verification_status || 'pending').toLowerCase();
        
        // Explicitly confirmed
        if (status === 'confirmed') {
          return true;
        }
        
        // Verification approved AND payment made
        if (verificationStatus === 'approved') {
          const hasPayment = 
            b.payment_screenshot_url || 
            b.manual_reference || 
            (b.advance_paid && Number(b.advance_paid) > 0);
          return hasPayment;
        }
        
        return false;
      });
      
      console.log('Fetched bookings for property', id, ':', {
        total: allBookings?.length || 0,
        blocking: blockingBookings.length,
        allStatuses: allBookings?.map((b: any) => ({ 
          status: b.status, 
          verification_status: b.verification_status,
          hasPayment: !!(b.payment_screenshot_url || b.manual_reference || (b.advance_paid && Number(b.advance_paid) > 0)),
          checkIn: b.check_in_date, 
          checkOut: b.check_out_date 
        })) || []
      });
      
      // Fetch blackout dates
      const { data: blackouts, error: blackoutsError } = await (supabase as any)
        .from('property_blackouts')
        .select('date')
        .eq('property_id', id);
      
      if (blackoutsError) {
        console.error('Error fetching blackouts:', blackoutsError);
      }
      
      console.log('Fetched unavailable dates:', { 
        bookings: blockingBookings.length, 
        blackouts: blackouts?.length || 0
      });
      
      return { 
        bookings: blockingBookings, 
        blackouts: blackouts || [] 
      };
    },
    enabled: !!id,
  });

  // Process unavailable dates into Date objects (normalized to midnight local time)
  useEffect(() => {
    if (!unavailableDatesData) return;
    
    const dates: Date[] = [];
    
    // Helper to normalize date to midnight local time for consistent comparison
    const normalizeDate = (date: Date): Date => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };
    
    // Add blackout dates
    unavailableDatesData.blackouts.forEach((blackout: any) => {
      const date = new Date(blackout.date + 'T00:00:00'); // Ensure we parse as date-only
      if (!isNaN(date.getTime())) {
        dates.push(normalizeDate(date));
      }
    });
    
    // Add booking date ranges
    unavailableDatesData.bookings.forEach((booking: any) => {
      const checkIn = new Date(booking.check_in_date + 'T00:00:00');
      const checkOut = new Date(booking.check_out_date + 'T00:00:00');
      
      if (!isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
        // Normalize dates
        const normalizedCheckIn = normalizeDate(checkIn);
        const normalizedCheckOut = normalizeDate(checkOut);
        
        // Add all dates in the range
        const current = new Date(normalizedCheckIn);
        while (current <= normalizedCheckOut) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
      }
    });
    
    // Remove duplicates by comparing date strings
    const uniqueDates = Array.from(
      new Map(
        dates.map(d => {
          const normalized = new Date(d);
          normalized.setHours(0, 0, 0, 0);
          return [normalized.getTime(), normalized];
        })
      ).values()
    );
    
    setUnavailableDates(uniqueDates);
    
    // Debug: Log unavailable dates
    if (uniqueDates.length > 0) {
      console.log('Unavailable dates set:', uniqueDates.map(d => format(d, 'yyyy-MM-dd')));
    }
  }, [unavailableDatesData]);

  // Check availability when dates change
  const checkInDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const checkOutDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : checkInDate;
  
  const { data: availabilityCheck } = useQuery({
    queryKey: ["availability", id, checkInDate, checkOutDate],
    queryFn: async () => {
      if (!id || !checkInDate) return null;
      const response = await api.checkAvailability(id, checkInDate, checkOutDate);
      return response;
    },
    enabled: !!id && !!checkInDate,
  });

  const calculateTotal = () => {
    if (!property || !dateRange?.from) return 0;
    
    // Calculate number of nights
    const checkIn = dateRange.from;
    const checkOut = dateRange.to || dateRange.from;
    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const basePrice = Number(property.pricing?.basePrice ?? property.base_price_per_night ?? 0);
    const perHeadPrice = Number(property.pricing?.perHeadPrice ?? property.per_head_charge ?? 0);
    const cleaningFee = Number(property.pricing?.extraFees?.cleaningFee ?? property.cleaning_fee ?? 0);
    const serviceFee = Number(property.pricing?.extraFees?.serviceFee ?? property.service_fee ?? 0);

    const baseAmount = basePrice * nights;
    // Guest charges only apply for guests beyond 4 (base covers first 4 guests)
    const numberOfGuests = Number(numGuests);
    const additionalGuests = Math.max(0, numberOfGuests - 4);
    const guestCharges = perHeadPrice * additionalGuests * nights;
    // Food is included in the base price, no separate charge
    const extraFees = cleaningFee + serviceFee;

    return baseAmount + guestCharges + extraFees;
  };

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.createBooking(data);
    },
    onSuccess: (response) => {
      const bookingId = response.data.id;
      toast.success("Booking created. Please review and agree to the terms.");
      setTimeout(() => {
        navigate(`/bookings/${bookingId}/agreement`);
      }, 800);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create booking");
    },
  });

  const [isBookingInProgress, setIsBookingInProgress] = useState(false);

  const handleBooking = async () => {
    // Prevent multiple simultaneous bookings
    if (isBookingInProgress || createBookingMutation.isPending) {
      return;
    }
    
    setIsBookingInProgress(true);
    
    try {
      if (!isAuthenticated) {
        toast.error("Please login to book a property");
        navigate("/login");
        setIsBookingInProgress(false);
        return;
      }

      // Check if phone number is provided
      try {
        const profileRes = await api.getProfile();
        const profile = profileRes.data;
        const hasPhone = profile?.phone && profile.phone.length > 0;
        
        if (!hasPhone) {
          toast.error("Phone number required. Please add your phone number in your profile before booking.");
          navigate("/profile");
          setIsBookingInProgress(false);
          return;
        }
      } catch (err) {
        // If profile fetch fails, backend will catch it anyway
        console.error("Error checking phone:", err);
      }

      if (!dateRange?.from) {
        toast.error("Please select check-in date");
        setIsBookingInProgress(false);
        return;
      }
      
      if (!dateRange.to) {
        toast.error("Please select check-out date");
        setIsBookingInProgress(false);
        return;
      }

      if (availabilityCheck && !availabilityCheck.available) {
        toast.error(availabilityCheck.reason || "Property not available for these dates");
        setIsBookingInProgress(false);
        return;
      }

      const maxGuests = property.capacity?.maxGuests || property.max_guests || 1;
      if (numGuests > maxGuests) {
        toast.error(`Maximum ${maxGuests} guests allowed`);
        setIsBookingInProgress(false);
        return;
      }

      const total = calculateTotal();
      if (total <= 0) {
        toast.error("Invalid booking dates");
        setIsBookingInProgress(false);
        return;
      }

      // Require food preference selection
      if (!foodPreference) {
        toast.error('Please select food preference (All Veg / All Non-Veg / Both).');
        setIsBookingInProgress(false);
        return;
      }
      
      // If "both" is selected, validate veg and non-veg guest counts
      if (foodPreference === 'both') {
        if (vegGuests <= 0 || nonVegGuests <= 0) {
          toast.error('Please specify number of veg and non-veg guests.');
          setIsBookingInProgress(false);
          return;
        }
        if (vegGuests + nonVegGuests !== numGuests) {
          toast.error(`Total veg and non-veg guests (${vegGuests + nonVegGuests}) must match total guests (${numGuests}).`);
          setIsBookingInProgress(false);
          return;
        }
      }

      const checkIn = format(dateRange.from, 'yyyy-MM-dd');
      const checkOut = format(dateRange.to, 'yyyy-MM-dd');
    
    // Build food preference string for special requests
    let foodPreferenceStr = '';
    if (foodPreference === 'all-veg') {
      foodPreferenceStr = `All Veg (${numGuests} guests)`;
    } else if (foodPreference === 'all-non-veg') {
      foodPreferenceStr = `All Non-Veg (${numGuests} guests)`;
    } else if (foodPreference === 'both') {
      foodPreferenceStr = `Both: ${vegGuests} Veg, ${nonVegGuests} Non-Veg`;
    }
    
    createBookingMutation.mutate({
      property: id,
      checkIn,
      checkOut,
      numberOfGuests: numGuests,
      foodRequired: true, // Food is always required now
      foodPreference: foodPreference === 'all-veg' ? 'veg' : foodPreference === 'all-non-veg' ? 'non-veg' : 'both',
      vegGuests: foodPreference === 'both' ? vegGuests : (foodPreference === 'all-veg' ? numGuests : 0),
      nonVegGuests: foodPreference === 'both' ? nonVegGuests : (foodPreference === 'all-non-veg' ? numGuests : 0),
      allergies: allergies || undefined,
      specialRequests: `Outside food not allowed. Food required: ${foodPreferenceStr}${allergies ? `; allergies: ${allergies}` : ''}`,
    }, {
      onSettled: () => {
        setIsBookingInProgress(false);
      }
    });
    } catch (error) {
      setIsBookingInProgress(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Property not found</h1>
          <Button onClick={() => navigate("/properties")}>Back to Properties</Button>
        </div>
      </div>
    );
  }

  const total = calculateTotal();
  const basePrice = property.pricing?.basePrice || property.base_price_per_night || 0;
  const perHeadPrice = property.pricing?.perHeadPrice || property.per_head_charge || 0;
  const cleaningFee = property.pricing?.extraFees?.cleaningFee || property.cleaning_fee || 0;
  const serviceFee = property.pricing?.extraFees?.serviceFee || property.service_fee || 0;
  const maxGuests = property.capacity?.maxGuests || property.max_guests || 1;

  const nights = dateRange?.from && dateRange?.to 
    ? Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0;

  const nextImage = () => {
    if (media.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % media.length);
  };

  const prevImage = () => {
    if (media.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  const facilities = property.facilities?.map((f: any) => typeof f === 'string' ? f : f.name) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-4">
          <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        {/* Image Gallery */}
        <div className="relative h-96 md:h-[500px] rounded-2xl overflow-hidden mb-8 group shadow-large">
          {media.length > 0 ? (
            <>
              {media[currentImageIndex]?.type === 'image' ? (
                <img
                  src={media[currentImageIndex]?.url || "/placeholder.svg"}
                  alt={property.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={media[currentImageIndex]?.url}
                  className="w-full h-full object-cover bg-black"
                  controls
                />
              )}
              {media.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm hover:bg-white p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm hover:bg-white p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {media.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === currentImageIndex
                            ? "bg-white w-8"
                            : "bg-white/50 w-2"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <p className="text-muted-foreground">No images available</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Property Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="animate-fade-in">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {property.name}
              </h1>
              <p className="text-lg md:text-xl font-semibold text-primary italic mb-3">
                Live a day the farm way
              </p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-5 w-5" />
                <span>
                  {typeof property.location === 'string' 
                    ? property.location 
                    : property.location?.address || 'Location'}
                  {typeof property.location === 'object' && property.location?.city && `, ${property.location.city}`}
                  {typeof property.location === 'object' && property.location?.state && `, ${property.location.state}`}
                </span>
              </div>
            </div>

            <Card className="shadow-soft animate-scale-in">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">About</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {property.description || "No description available."}
                </p>
                <div className="mt-4 p-3 rounded-lg bg-amber-50 text-amber-900 text-sm border border-amber-200">
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Check-in:</strong> 9:00 AM &nbsp; <strong>Check-out:</strong> 7:00 PM</li>
                    <li><strong>Multi-day bookings:</strong> You can book for multiple consecutive days.</li>
                    <li><strong>Outside food not allowed.</strong></li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft animate-scale-in">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Facilities</h2>
                <div className="flex flex-wrap gap-3">
                  {facilities.map((facility: string, idx: number) => {
                    const Icon = facilityIcons[facility] || null;
                    return (
                      <Badge key={idx} variant="secondary" className="px-4 py-2 gap-2">
                        {Icon && <Icon className="h-4 w-4" />}
                        {facility}
                      </Badge>
                    );
                  })}
                  {facilities.length === 0 && (
                    <span className="text-muted-foreground">
                      No facilities listed
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Reviews Section */}
            <Card className="shadow-soft animate-scale-in">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Reviews</h2>
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        <span className="ml-1 font-semibold">{averageRating.toFixed(1)}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>
                  )}
                </div>
                {reviews.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No reviews yet. Be the first to review this property!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review: any) => (
                      <div key={review.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold">
                              {review.profiles?.full_name || 'Anonymous'}
                            </p>
                            {review.bookings && (
                              <p className="text-xs text-muted-foreground">
                                Stayed {format(new Date(review.bookings.check_in_date), 'MMM yyyy')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= review.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(review.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 shadow-xl animate-scale-in">
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-xl text-muted-foreground">Starting from</p>
                  <p className="text-3xl font-bold text-primary">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(basePrice)}
                  </p>
                  <p className="text-sm text-muted-foreground">per day</p>
                  {perHeadPrice > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Base covers up to 4 guests. Additional guests: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(perHeadPrice)} per guest per day
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Select dates
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal border-2"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "dd-MM-yyyy")} -{" "}
                                {format(dateRange.to, "dd-MM-yyyy")}
                              </>
                            ) : (
                              format(dateRange.from, "dd-MM-yyyy")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                          disabled={(date) => {
                            // Disable past dates
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const dateNormalized = new Date(date);
                            dateNormalized.setHours(0, 0, 0, 0);
                            if (dateNormalized < today) return true;
                            
                            // Disable unavailable dates - compare by timestamp for accuracy
                            return unavailableDates.some(
                              (unavailable) => {
                                const unavailableNormalized = new Date(unavailable);
                                unavailableNormalized.setHours(0, 0, 0, 0);
                                return unavailableNormalized.getTime() === dateNormalized.getTime();
                              }
                            );
                          }}
                          modifiers={{
                            unavailable: unavailableDates,
                          }}
                          modifiersClassNames={{
                            unavailable: "bg-red-100 text-red-700 hover:bg-red-200 font-semibold border border-red-300 cursor-not-allowed",
                          }}
                          className="rounded-md border"
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-1">
                      Full-day booking. Check-in 9:00 AM, Check-out 7:00 PM.
                      {unavailableDates.length > 0 && (
                        <span className="text-destructive ml-1">
                          Unavailable dates are disabled
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Guests
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        type="number"
                        min="1"
                        max={maxGuests}
                        value={numGuests}
                        onChange={(e) =>
                          setNumGuests(Math.min(parseInt(e.target.value) || 1, maxGuests))
                        }
                        className="pl-10 border-2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max {maxGuests} guests
                    </p>
                  </div>

                  {/* Food Selection - Always Required */}
                  <div className="pt-2">
                    <div className="mb-3">
                      <label className="text-sm font-medium">Food Preference <span className="text-destructive">*</span></label>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <div className="flex gap-2 flex-wrap">
                          <button 
                            type="button" 
                            className={`px-4 py-2 rounded border capitalize ${foodPreference === 'all-veg' ? 'bg-primary text-primary-foreground' : 'bg-background'}`} 
                            onClick={() => {
                              setFoodPreference('all-veg');
                              setVegGuests(0);
                              setNonVegGuests(0);
                            }}
                          >
                            All Veg
                          </button>
                          <button 
                            type="button" 
                            className={`px-4 py-2 rounded border capitalize ${foodPreference === 'all-non-veg' ? 'bg-primary text-primary-foreground' : 'bg-background'}`} 
                            onClick={() => {
                              setFoodPreference('all-non-veg');
                              setVegGuests(0);
                              setNonVegGuests(0);
                            }}
                          >
                            All Non-Veg
                          </button>
                          <button 
                            type="button" 
                            className={`px-4 py-2 rounded border capitalize ${foodPreference === 'both' ? 'bg-primary text-primary-foreground' : 'bg-background'}`} 
                            onClick={() => setFoodPreference('both')}
                          >
                            Both
                          </button>
                        </div>
                      </div>
                      
                      {foodPreference === 'both' && (
                        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                          <div>
                            <label className="text-sm font-medium mb-1 block">Veg Guests <span className="text-destructive">*</span></label>
                            <Input 
                              type="number" 
                              min="1" 
                              max={numGuests} 
                              value={vegGuests || ''} 
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setVegGuests(val);
                                setNonVegGuests(Math.max(0, numGuests - val));
                              }} 
                              className="border-2" 
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1 block">Non-Veg Guests <span className="text-destructive">*</span></label>
                            <Input 
                              type="number" 
                              min="1" 
                              max={numGuests} 
                              value={nonVegGuests || ''} 
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setNonVegGuests(val);
                                setVegGuests(Math.max(0, numGuests - val));
                              }} 
                              className="border-2" 
                              placeholder="0"
                            />
                          </div>
                          <div className="col-span-2 text-xs text-muted-foreground">
                            Total: {vegGuests + nonVegGuests} / {numGuests} guests
                            {vegGuests + nonVegGuests !== numGuests && (
                              <span className="text-destructive ml-2">(Must match total guests)</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <label className="text-sm font-medium mb-1 block">Allergies (optional)</label>
                        <Input 
                          type="text" 
                          placeholder="e.g., peanuts, gluten" 
                          value={allergies} 
                          onChange={(e) => setAllergies(e.target.value)} 
                          className="border-2" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {availabilityCheck && !availabilityCheck.available && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">
                      {availabilityCheck.reason || "Not available for these dates"}
                    </p>
                  </div>
                )}

                {dateRange?.from && dateRange?.to && total > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Base amount ({nights} {nights === 1 ? 'day' : 'days'})</span>
                      <span>
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(basePrice * nights)}
                      </span>
                    </div>
                    {(() => {
                      const numberOfGuests = Number(numGuests);
                      const additionalGuests = Math.max(0, numberOfGuests - 4);
                      const guestCharges = perHeadPrice * additionalGuests * nights;
                      return guestCharges > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Guest charges ({additionalGuests} additional {additionalGuests === 1 ? 'guest' : 'guests'} × ₹{perHeadPrice.toLocaleString('en-IN')} × {nights} {nights === 1 ? 'day' : 'days'})</span>
                          <span>
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(guestCharges)}
                          </span>
                        </div>
                      );
                    })()}
                    {(cleaningFee > 0 || serviceFee > 0) && (
                      <div className="flex justify-between text-sm">
                        <span>Extra fees</span>
                        <span>
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cleaningFee + serviceFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(total)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1">
                      Token Amount: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(5000)} (Non-refundable)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Full payment required 48 hours before check-in
                    </div>
                    <div className="text-xs text-destructive/80">
                      Note: Token amount of ₹5,000 is non-refundable and must be paid immediately.
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleBooking}
                  disabled={!dateRange?.from || !dateRange?.to || total <= 0 || (availabilityCheck && !availabilityCheck.available) || createBookingMutation.isPending || isBookingInProgress}
                >
                  {createBookingMutation.isPending ? "Processing..." : "Book Now"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetails;
