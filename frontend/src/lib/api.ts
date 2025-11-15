// Supabase-based API client (no backend required)
// All operations use Supabase directly with RLS policies

import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// Helper to get current user ID (synchronous version for quick checks)
const getCurrentUserIdSync = (): string | null => {
  try {
    // Try to get from cached session
    const session = (supabase.auth as any).session();
    return session?.user?.id || null;
  } catch {
    return null;
  }
};

// Helper to get current user ID (async version)
const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
};

// Helper to check if user is admin
const isAdmin = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  
  // If error or no data, user is not admin
  if (error || !data) return false;
  
  return !!data;
};

// Helper to upload file to Supabase Storage
const uploadFile = async (file: File, path: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from('images')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
};

// API client class - maintains same interface as before
class ApiClient {
  // Auth endpoints (not used with Supabase Auth, but kept for compatibility)
  async login(_email: string, _password: string) {
    throw new Error('Use AuthContext.login instead');
  }

  async register(_name: string, _email: string, _password: string, _phone?: string) {
    throw new Error('Use AuthContext.register instead');
  }

  async getCurrentUser() {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    return { success: true, user: profile };
  }

  async updateProfile(data: any) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, user: profile };
  }

  async changePassword(_currentPassword: string, _newPassword: string) {
    // Supabase handles password changes via auth.updateUser
    throw new Error('Use supabase.auth.updateUser for password changes');
  }

  // Profile endpoints
  async getProfile() {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async updateProfileSupabase(update: { full_name?: string; phone?: string; phone_verified?: boolean }) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  logout() {
    // Handled by AuthContext
  }

  // Properties endpoints
  async getProperties(params?: {
    city?: string;
    state?: string;
    maxGuests?: number;
    minPrice?: number;
    maxPrice?: number;
    facilities?: string[];
    search?: string;
    status?: 'active' | 'inactive' | 'all';
    page?: number;
    limit?: number;
  }) {
    let query = supabase.from('properties').select('*', { count: 'exact' });
    
    // Admin can see all, others only active
    if (params?.status !== 'all') {
      const admin = await isAdmin();
      if (!admin) {
        query = query.eq('is_active', true);
      }
    }
    
    if (params?.search) {
      query = query.ilike('name', `%${params.search}%`);
    }
    
    if (params?.city) {
      query = query.eq('city', params.city);
    }
    
    if (params?.state) {
      query = query.eq('state', params.state);
    }
    
    if (params?.minPrice) {
      query = query.gte('base_price_per_night', params.minPrice);
    }
    
    if (params?.maxPrice) {
      query = query.lte('base_price_per_night', params.maxPrice);
    }
    
    if (params?.maxGuests) {
      query = query.gte('max_guests', params.maxGuests);
    }
    
    if (params?.facilities && params.facilities.length > 0) {
      query = query.contains('facilities', params.facilities);
    }
    
    const limit = params?.limit || 20;
    const page = params?.page || 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    query = query.range(from, to).order('created_at', { ascending: false });
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Transform to match expected format
    const transformed = (data || []).map((prop: any) => ({
      ...prop,
      _id: prop.id,
      id: prop.id,
      name: prop.name,
      description: prop.description,
      location: {
        address: prop.location || '',
        city: prop.city || '',
        state: prop.state || '',
        zipCode: prop.zip_code || '',
      },
      googleMapsUrl: (prop as any).google_maps_url || '',
      pricing: {
        basePrice: Number(prop.base_price_per_night || 0),
        perHeadPrice: Number(prop.per_head_charge || 0),
        extraFees: {
          cleaningFee: Number(prop.cleaning_fee || 0),
          serviceFee: Number(prop.service_fee || 0),
        },
      },
      capacity: {
        maxGuests: prop.max_guests || 1,
      },
      facilities: (prop.facilities || []).map((f: string) => ({ name: f })),
      images: (prop.images || []).map((img: string) => ({ url: img })),
      videos: (prop as any).videos || [],
      status: prop.is_active ? 'active' : 'inactive',
      availability: {
        isAvailable: prop.is_active,
      },
    }));
    
    return {
      success: true,
      data: transformed,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
    };
  }

  async getProperty(id: string) {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    // Transform to match expected format
    const property = {
      ...data,
      _id: data.id,
      id: data.id,
      name: data.name,
      description: data.description,
      location: {
        address: data.location || '',
        city: data.city || '',
        state: data.state || '',
        zipCode: data.zip_code || '',
      },
      googleMapsUrl: (data as any).google_maps_url || '',
      pricing: {
        basePrice: Number(data.base_price_per_night || 0),
        perHeadPrice: Number(data.per_head_charge || 0),
        extraFees: {
          cleaningFee: Number(data.cleaning_fee || 0),
          serviceFee: Number(data.service_fee || 0),
        },
      },
      capacity: {
        maxGuests: data.max_guests || 1,
      },
      facilities: (data.facilities || []).map((f: string) => ({ name: f })),
      images: (data.images || []).map((img: string) => ({ url: img })),
      videos: (data as any).videos || [],
      status: data.is_active ? 'active' : 'inactive',
      availability: {
        isAvailable: data.is_active,
      },
    };
    
    return { success: true, data: property };
  }

  async createProperty(propertyData: any) {
    const admin = await isAdmin();
    if (!admin) throw new Error('Admin access required');
    
    const { data, error } = await supabase
      .from('properties')
      .insert({
        name: propertyData.name,
        description: propertyData.description,
        location: propertyData.location?.address || propertyData.location,
        city: propertyData.location?.city,
        state: propertyData.location?.state,
        zip_code: propertyData.location?.zipCode,
        google_maps_url: propertyData.googleMapsUrl,
        base_price_per_night: propertyData.pricing.basePrice,
        per_head_charge: propertyData.pricing.perHeadPrice || 0,
        cleaning_fee: propertyData.pricing.extraFees.cleaningFee || 0,
        service_fee: propertyData.pricing.extraFees.serviceFee || 0,
        max_guests: propertyData.capacity.maxGuests,
        facilities: propertyData.facilities?.map((f: any) => typeof f === 'string' ? f : f.name) || [],
        images: propertyData.images?.map((img: any) => typeof img === 'string' ? img : img.url) || [],
        videos: propertyData.videos || [],
        is_active: propertyData.status === 'active',
      })
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async updateProperty(id: string, propertyData: any) {
    const admin = await isAdmin();
    if (!admin) throw new Error('Admin access required');
    
    const { data, error } = await supabase
      .from('properties')
      .update({
        name: propertyData.name,
        description: propertyData.description,
        location: propertyData.location?.address || propertyData.location,
        city: propertyData.location?.city,
        state: propertyData.location?.state,
        zip_code: propertyData.location?.zipCode,
        google_maps_url: propertyData.googleMapsUrl,
        base_price_per_night: propertyData.pricing.basePrice,
        per_head_charge: propertyData.pricing.perHeadPrice || 0,
        cleaning_fee: propertyData.pricing.extraFees.cleaningFee || 0,
        service_fee: propertyData.pricing.extraFees.serviceFee || 0,
        max_guests: propertyData.capacity.maxGuests,
        facilities: propertyData.facilities?.map((f: any) => typeof f === 'string' ? f : f.name) || [],
        images: propertyData.images?.map((img: any) => typeof img === 'string' ? img : img.url) || [],
        videos: propertyData.videos || [],
        is_active: propertyData.status === 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async deleteProperty(id: string) {
    const admin = await isAdmin();
    if (!admin) throw new Error('Admin access required');
    
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true, message: 'Property deleted' };
  }

  async checkAvailability(propertyId: string, checkIn: string, checkOut: string) {
    // Check blackouts - check if any date in the range is blacked out
    const requestedCheckIn = new Date(checkIn);
    const requestedCheckOut = new Date(checkOut);
    const datesToCheck: string[] = [];
    const current = new Date(requestedCheckIn);
    while (current <= requestedCheckOut) {
      datesToCheck.push(format(current, 'yyyy-MM-dd'));
      current.setDate(current.getDate() + 1);
    }
    
    if (datesToCheck.length > 0) {
      const { data: blackouts } = await (supabase as any)
        .from('property_blackouts')
        .select('date')
        .eq('property_id', propertyId)
        .in('date', datesToCheck);
      
      if (blackouts && blackouts.length > 0) {
        return { success: true, available: false, reason: 'Property is blacked out for these dates' };
      }
    }
    
    // Check existing bookings that should block dates:
    // 1. Status is explicitly 'confirmed', OR
    // 2. Verification is approved AND payment has been made
    // Fetch all bookings for this property and filter in JavaScript
    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date, status, verification_status, payment_screenshot_url, manual_reference, advance_paid')
      .eq('property_id', propertyId);
    
    if (error) {
      console.error('Availability check error:', error);
      // If query fails, be conservative and say unavailable
      return { success: true, available: false, reason: 'Unable to verify availability' };
    }
    
    // Filter to bookings that should block dates
    const blockingBookings = (allBookings || []).filter((booking: any) => {
      const status = (booking.status || '').toLowerCase();
      const verificationStatus = (booking.verification_status || 'pending').toLowerCase();
      
      // Explicitly confirmed
      if (status === 'confirmed') {
        return true;
      }
      
      // Verification approved AND payment made
      if (verificationStatus === 'approved') {
        const hasPayment = 
          booking.payment_screenshot_url || 
          booking.manual_reference || 
          (booking.advance_paid && Number(booking.advance_paid) > 0);
        return hasPayment;
      }
      
      return false;
    });
    
    // Check for date range overlap: booking overlaps if check_in_date < checkOut AND check_out_date > checkIn
    const hasOverlap = blockingBookings.some((booking: any) => {
      const bookingCheckIn = new Date(booking.check_in_date);
      const bookingCheckOut = new Date(booking.check_out_date);
      
      // Check if date ranges overlap
      // Overlap occurs when: bookingCheckIn < requestedCheckOut AND bookingCheckOut > requestedCheckIn
      return bookingCheckIn < requestedCheckOut && bookingCheckOut > requestedCheckIn;
    });
    
    if (hasOverlap) {
      return { success: true, available: false, reason: 'Property is already booked for these dates' };
    }
    
    return { success: true, available: true };
  }

  // Property blackout dates (admin)
  async getPropertyBlackouts(propertyId: string) {
    const { data, error } = await (supabase as any)
      .from('property_blackouts')
      .select('*')
      .eq('property_id', propertyId)
      .order('date', { ascending: true });
    
    if (error) throw error;
    return { success: true, data: data || [] };
  }

  async addPropertyBlackouts(propertyId: string, dates: string[], reason?: string) {
    const admin = await isAdmin();
    if (!admin) throw new Error('Admin access required');
    
    // Use upsert to handle duplicates gracefully (on conflict with property_id + date)
    const { data, error } = await (supabase as any)
      .from('property_blackouts')
      .upsert(
        dates.map((date: string) => ({
          property_id: propertyId,
          date,
          reason: reason || null,
        })),
        { onConflict: 'property_id,date' }
      )
      .select();
    
    if (error) throw error;
    return { success: true, data: data || [] };
  }

  async removePropertyBlackouts(propertyId: string, dates: string[]) {
    const admin = await isAdmin();
    if (!admin) throw new Error('Admin access required');
    
    const { error } = await (supabase as any)
      .from('property_blackouts')
      .delete()
      .eq('property_id', propertyId)
      .in('date', dates);
    
    if (error) throw error;
    return { success: true, message: 'Blackouts removed' };
  }

  // Bookings endpoints
  async getBookings(params?: {
    status?: string;
    property?: string;
    verification?: string;
    page?: number;
    limit?: number;
  }) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    const admin = await isAdmin();
    // Fetch bookings with properties - fetch profiles separately to avoid FK syntax issues
    let query = supabase.from('bookings').select('*, properties(name)', { count: 'exact' });
    
    // Non-admins only see their own bookings
    if (!admin) {
      query = query.eq('customer_id', userId);
    }
    
    if (params?.status) {
      query = query.eq('status', params.status);
    }
    
    if (params?.property) {
      query = query.eq('property_id', params.property);
    }
    
    if (params?.verification) {
      query = (query as any).eq('verification_status', params.verification);
    }
    
    const limit = params?.limit || 20;
    const page = params?.page || 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    query = query.range(from, to).order('created_at', { ascending: false });
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Fetch customer profiles separately
    const customerIds = [...new Set((data || []).map((b: any) => b.customer_id).filter(Boolean))];
    const customerNames: Record<string, string> = {};
    
    if (customerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', customerIds);
      
      if (profiles) {
        profiles.forEach((p: any) => {
          customerNames[p.id] = p.full_name || '';
        });
      }
    }
    
    // Transform data to include property_name and customer_name
    const transformed = (data || []).map((booking: any) => ({
      ...booking,
      _id: booking.id,
      id: booking.id,
      property_name: typeof booking.properties === 'object' ? booking.properties?.name : null,
      customer_name: customerNames[booking.customer_id] || null,
    }));
    
    return {
      success: true,
      data: transformed,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
    };
  }

  async getBooking(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    const admin = await isAdmin();
    
    // Fetch booking with property - fetch profile separately
    let query = supabase
      .from('bookings')
      .select('*, properties(*)')
      .eq('id', id)
      .single();
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Check access
    if (!admin && data.customer_id !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Fetch customer profile separately
    if (data.customer_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.customer_id)
        .single();
      
      if (profile) {
        (data as any).profiles = profile;
      }
    }
    
    return { success: true, data };
  }

  async createBooking(bookingData: {
    property: string;
    checkIn: string;
    checkOut: string;
    numberOfGuests: number;
    specialRequests?: string;
    foodRequired?: boolean;
    foodPreference?: 'veg' | 'non-veg' | 'both';
    allergies?: string;
  }) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    // Check for existing booking with same property, customer, and date range
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('property_id', bookingData.property)
      .eq('customer_id', userId)
      .eq('check_in_date', bookingData.checkIn)
      .eq('check_out_date', bookingData.checkOut)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();
    
    if (existingBooking) {
      throw new Error('You already have a booking for these dates. Please check your bookings.');
    }
    
    // Get property details
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', bookingData.property)
      .single();
    
    if (propError || !property) throw new Error('Property not found');
    
    // Calculate pricing
    // Base amount covers up to 2 guests, additional guests pay per-head charge
    // Calculate number of nights from check-in to check-out
    const checkInDate = new Date(bookingData.checkIn);
    const checkOutDate = new Date(bookingData.checkOut);
    const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    const basePrice = Number(property.base_price_per_night || 0);
    const perHeadPrice = Number(property.per_head_charge || 0);
    const cleaningFee = Number(property.cleaning_fee || 0);
    const serviceFee = Number(property.service_fee || 0);
    
    const baseAmount = basePrice * nights;
    // Guest charges only apply for guests beyond 2 (base covers first 2 guests)
    const additionalGuests = Math.max(0, bookingData.numberOfGuests - 2);
    const guestCharges = perHeadPrice * additionalGuests * nights;
    const foodCharges = bookingData.foodRequired ? 500 * bookingData.numberOfGuests * nights : 0;
    const extraFees = cleaningFee + serviceFee;
    const totalAmount = baseAmount + guestCharges + foodCharges + extraFees;
    
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        property_id: bookingData.property,
        customer_id: userId,
        check_in_date: bookingData.checkIn,
        check_out_date: bookingData.checkOut,
        num_guests: bookingData.numberOfGuests,
        base_amount: baseAmount,
        guest_charges: guestCharges,
        extra_fees: extraFees,
        total_amount: totalAmount,
        status: 'pending',
        verification_status: 'pending' as any,
        special_requests: bookingData.specialRequests,
        food_required: bookingData.foodRequired || false,
        food_preference: bookingData.foodPreference || null,
        allergies: bookingData.allergies || null,
      })
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async confirmBooking(id: string) {
    const admin = await isAdmin();
    if (!admin) throw new Error('Admin access required');
    
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async cancelBooking(id: string, reason?: string) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    const admin = await isAdmin();
    
    // Get booking to check ownership
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id')
      .eq('id', id)
      .single();
    
    if (!booking) throw new Error('Booking not found');
    
    if (!admin && booking.customer_id !== userId) {
      throw new Error('Unauthorized');
    }
    
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async completeBooking(id: string) {
    const admin = await isAdmin();
    if (!admin) throw new Error('Admin access required');
    
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async verifyBooking(id: string, status: 'approved' | 'rejected' | 'pending') {
    const admin = await isAdmin();
    if (!admin) throw new Error('Admin access required');
    
    const { data, error } = await supabase
      .from('bookings')
      .update({ verification_status: status } as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async uploadBookingIdProofs(bookingId: string, files: File[]) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    // Verify booking ownership
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id')
      .eq('id', bookingId)
      .single();
    
    if (!booking || booking.customer_id !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Upload files
    const uploads = await Promise.all(
      files.map(async (file) => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const ext = file.name.split('.').pop();
        const path = `id_proofs/${bookingId}/${timestamp}-${random}.${ext}`;
        return uploadFile(file, path);
      })
    );
    
    // Update booking with ID proof URLs
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    const existingUrls = (existingBooking as any)?.id_proofs || [];
    const newUrls = [...existingUrls, ...uploads];
    
    const { error } = await supabase
      .from('bookings')
      .update({ id_proofs: newUrls } as any)
      .eq('id', bookingId);
    
    if (error) throw error;
    
    return { success: true, data: uploads };
  }

  // Payment endpoints
  async createPaymentIntent(bookingId: string) {
    // Manual payment mode - no Stripe needed
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    if (!booking) throw new Error('Booking not found');
    
    const advanceAmount = Math.round(Number(booking.total_amount || 0) * 0.5 * 100) / 100;
    
    return {
      success: true,
      clientSecret: null,
      amount: advanceAmount,
      booking,
      mode: 'manual' as const,
    };
  }

  async confirmPayment(_bookingId: string, _paymentIntentId: string, _unused?: any, _extra?: { referenceId?: string; amount?: number }) {
    throw new Error('Use confirmPaymentWithScreenshot instead');
  }

  async confirmPaymentWithScreenshot(bookingId: string, file: File, extra?: { referenceId?: string; amount?: number }) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');
    
    // Upload screenshot
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop();
    const path = `payment_screenshots/${bookingId}/${timestamp}-${random}.${ext}`;
    const screenshotUrl = await uploadFile(file, path);
    
    // Update booking
    const updates: any = {
      payment_screenshot_url: screenshotUrl,
      advance_paid: extra?.amount || 0,
    };
    
    if (extra?.referenceId) {
      updates.manual_reference = extra.referenceId;
    }
    
    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .eq('customer_id', userId) // Ensure user owns this booking
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  async getPaymentDetails(bookingId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    if (error) throw error;
    return { success: true, data };
  }

  // Upload endpoints
  async uploadImage(file: File) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop();
    const path = `properties/${timestamp}-${random}.${ext}`;
    const url = await uploadFile(file, path);
    
    return { success: true, data: { url, path } };
  }

  async uploadImages(files: File[]) {
    const uploads = await Promise.all(
      files.map(async (file) => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const ext = file.name.split('.').pop();
        const path = `properties/${timestamp}-${random}.${ext}`;
        const url = await uploadFile(file, path);
        return { url, path };
      })
    );
    
    return { success: true, data: uploads };
  }

  async uploadVideos(files: File[]) {
    const uploads = await Promise.all(
      files.map(async (file) => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const ext = file.name.split('.').pop();
        const path = `properties/${timestamp}-${random}.${ext}`;
        const url = await uploadFile(file, path);
        return { url };
      })
    );
    
    return { success: true, data: uploads };
  }

  async deleteImage(_filename: string) {
    // Implement if needed
    return { success: true, message: 'Image deleted' };
  }
}

export const api = new ApiClient();
export default api;
