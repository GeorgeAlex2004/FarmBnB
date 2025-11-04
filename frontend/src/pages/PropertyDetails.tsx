import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Users, Calendar, ChevronLeft, ChevronRight, Wifi, Car, UtensilsCrossed, Waves, Dog, Snowflake, Flame } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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
  const [bookingDate, setBookingDate] = useState("");
  const [numGuests, setNumGuests] = useState(2);
  const [foodRequired, setFoodRequired] = useState<boolean | null>(null);
  const [foodPreference, setFoodPreference] = useState<'veg' | 'non-veg' | 'both' | ''>('');
  const [allergies, setAllergies] = useState('');

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

  // Check availability when dates change
  const { data: availabilityCheck } = useQuery({
    queryKey: ["availability", id, bookingDate],
    queryFn: async () => {
      if (!id || !bookingDate) return null;
      const response = await api.checkAvailability(id, bookingDate, bookingDate);
      return response;
    },
    enabled: !!id && !!bookingDate,
  });

  const calculateTotal = () => {
    if (!property || !bookingDate) return 0;
    const nights = 1; // Full-day booking with fixed times

    const basePrice = Number(property.pricing?.basePrice ?? property.basePricePerNight ?? property.base_price_per_night ?? 0);
    const perHeadPrice = Number(property.pricing?.perHeadPrice ?? property.perHeadCharge ?? property.per_head_charge ?? 0);
    const cleaningFee = Number(property.pricing?.extraFees?.cleaningFee ?? property.cleaningFee ?? 0);
    const serviceFee = Number(property.pricing?.extraFees?.serviceFee ?? property.serviceFee ?? 0);

    const baseAmount = basePrice * nights;
    const guestCharges = perHeadPrice * Number(numGuests) * nights;
    const foodCharges = foodRequired ? 500 * Number(numGuests) * nights : 0;
    const extraFees = cleaningFee + serviceFee;

    return baseAmount + guestCharges + foodCharges + extraFees;
  };

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.createBooking(data);
    },
    onSuccess: (response) => {
      const bookingId = response.data._id || response.data.id;
      toast.success("Booking created. Upload ID Proofs to proceed.");
      setTimeout(() => {
        navigate(`/bookings/${bookingId}/id-proof`);
      }, 800);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create booking");
    },
  });

  const handleBooking = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to book a property");
      navigate("/login");
      return;
    }

    // Check if phone number is provided (verification is optional due to Firebase billing)
    try {
      const profileRes = await api.getProfile();
      const profile = profileRes.data;
      const hasPhone = profile?.phone && profile.phone.length > 0;
      
      if (!hasPhone) {
        toast.error("Phone number required. Please add your phone number in your profile before booking.");
        navigate("/profile");
        return;
      }
    } catch (err) {
      // If profile fetch fails, backend will catch it anyway
      console.error("Error checking phone:", err);
    }

    if (!bookingDate) {
      toast.error("Please select a date");
      return;
    }

    // Enforce same-day bookings (no overnight stays)
    // Always same-day booking; backend enforces as well

    if (availabilityCheck && !availabilityCheck.available) {
      toast.error(availabilityCheck.reason || "Property not available for these dates");
      return;
    }

    const maxGuests = property.capacity?.maxGuests || property.maxGuests;
    if (numGuests > maxGuests) {
      toast.error(`Maximum ${maxGuests} guests allowed`);
      return;
    }

    const total = calculateTotal();
    if (total <= 0) {
      toast.error("Invalid booking dates");
      return;
    }

    // Require food selection
    if (foodRequired === null) {
      toast.error('Please specify if you require food.');
      return;
    }
    if (foodRequired && !foodPreference) {
      toast.error('Please choose veg / non-veg / both.');
      return;
    }

    createBookingMutation.mutate({
      property: id,
      checkIn: bookingDate,
      checkOut: bookingDate,
      numberOfGuests: numGuests,
      foodRequired,
      foodPreference: foodPreference || undefined,
      allergies: allergies || undefined,
      specialRequests: `Outside food not allowed. Food ${foodRequired ? `required (${foodPreference})` : 'not required'}${allergies ? `; allergies: ${allergies}` : ''}`,
    });
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
  const basePrice = property.pricing?.basePrice || property.basePricePerNight || property.base_price_per_night || 0;
  const perHeadPrice = property.pricing?.perHeadPrice || property.perHeadCharge || property.per_head_charge || 0;
  const cleaningFee = property.pricing?.extraFees?.cleaningFee || property.cleaningFee || 0;
  const serviceFee = property.pricing?.extraFees?.serviceFee || property.serviceFee || 0;
  const maxGuests = property.capacity?.maxGuests || property.maxGuests || property.max_guests || 1;

  const nights = bookingDate ? 1 : 0;

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
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-5 w-5" />
                <span>
                  {property.location?.address || property.location || 'Location'}
                  {property.location?.city && `, ${property.location.city}`}
                  {property.location?.state && `, ${property.location.state}`}
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
                    <li><strong>No overnight stay:</strong> Same-day check-in and check-out only.</li>
                    <li><strong>Check-in:</strong> 9:00 AM &nbsp; <strong>Check-out:</strong> 7:00 PM</li>
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
                      + {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(perHeadPrice)} per guest per day
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Select date
                    </label>
                    <Input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="border-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Full-day booking. Check-in 9:00 AM, Check-out 7:00 PM.</p>
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

                  {/* Food Selection */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium">Food required?</label>
                      <span className="text-xs text-muted-foreground">+ ₹500 per person</span>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" className={`px-3 py-1 rounded border ${foodRequired === true ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => setFoodRequired(true)}>Yes</button>
                      <button type="button" className={`px-3 py-1 rounded border ${foodRequired === false ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => setFoodRequired(false)}>No</button>
                    </div>
                  </div>

                  {foodRequired && (
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Preference</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['veg','non-veg','both'] as const).map(opt => (
                            <button key={opt} type="button" className={`px-3 py-1 rounded border capitalize ${foodPreference === opt ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => setFoodPreference(opt)}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Allergies (optional)</label>
                        <Input type="text" placeholder="e.g., peanuts, gluten" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="border-2" />
                      </div>
                    </div>
                  )}
                </div>

                {availabilityCheck && !availabilityCheck.available && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">
                      {availabilityCheck.reason || "Not available for these dates"}
                    </p>
                  </div>
                )}

                {bookingDate && total > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Base amount (1 day)</span>
                      <span>
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(basePrice)}
                      </span>
                    </div>
                    {perHeadPrice > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Guest charges ({numGuests} guests × 1 day)</span>
                        <span>
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(perHeadPrice * numGuests)}
                        </span>
                      </div>
                    )}
                    {foodRequired && (
                      <div className="flex justify-between text-sm">
                        <span>Food charges ({numGuests} guests × 1 day)</span>
                        <span>
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(500 * numGuests)}
                        </span>
                      </div>
                    )}
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
                      Advance: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Math.round(total * 0.5 * 100) / 100)} (50%)
                    </div>
                    <div className="text-xs text-destructive/80">
                      Note: Advance amount is non-refundable.
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleBooking}
                  disabled={!bookingDate || total <= 0 || (availabilityCheck && !availabilityCheck.available) || createBookingMutation.isPending}
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
