const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to get Firebase ID token from current user (fallback to legacy token)
const getAuthToken = async (): Promise<string | null> => {
  try {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (!token) {
        console.warn('Firebase user exists but getIdToken returned null');
      }
      return token;
    } else {
      console.warn('No Firebase user logged in');
    }
  } catch (error) {
    console.error('Error getting Firebase token:', error);
    // ignore if firebase/auth not initialized
  }
  // Fallback to legacy token (for backwards compatibility)
  const legacyToken = localStorage.getItem('token');
  if (legacyToken) {
    console.warn('Using legacy token from localStorage');
  }
  return legacyToken;
};

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }
  
  return data;
};

// API client class
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('No auth token available for request to', endpoint);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    // If we get a 401, it might be because the token is expired or invalid
    if (response.status === 401) {
      console.error('Unauthorized request to', endpoint, '- Token may be expired or invalid');
      // Try to refresh the token if possible
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          // Force token refresh
          const newToken = await user.getIdToken(true);
          headers['Authorization'] = `Bearer ${newToken}`;
          // Retry the request once
          const retryResponse = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers,
          });
          return handleResponse(retryResponse);
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
      }
    }

    return handleResponse(response);
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const data = await this.request<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.success && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  }

  async register(name: string, email: string, password: string, phone?: string) {
    const data = await this.request<{ success: boolean; token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone }),
    });

    if (data.success && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  }

  async getCurrentUser() {
    return this.request<{ success: boolean; user: any }>('/auth/me');
  }

  async updateProfile(data: any) {
    return this.request<{ success: boolean; user: any }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Firebase + Supabase profile endpoints
  async getProfile() {
    return this.request<{ success: boolean; data: { id: string; full_name: string | null; phone: string | null; phone_verified?: boolean } }>(
      '/profile'
    );
  }

  async updateProfileSupabase(update: { full_name?: string; phone?: string; phone_verified?: boolean }) {
    return this.request<{ success: boolean; data: any }>(
      '/profile', { method: 'PUT', body: JSON.stringify(update) }
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
    page?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, String(value));
          }
        }
      });
    }

    const queryString = queryParams.toString();
    const endpoint = `/properties${queryString ? `?${queryString}` : ''}`;
    
    return this.request<{
      success: boolean;
      data: any[];
      total: number;
      page: number;
      pages: number;
    }>(endpoint);
  }

  async getProperty(id: string) {
    return this.request<{ success: boolean; data: any }>(`/properties/${id}`);
  }

  async createProperty(data: any) {
    return this.request<{ success: boolean; data: any }>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProperty(id: string, data: any) {
    return this.request<{ success: boolean; data: any }>(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProperty(id: string) {
    return this.request<{ success: boolean; message: string }>(`/properties/${id}`, {
      method: 'DELETE',
    });
  }

  async checkAvailability(propertyId: string, checkIn: string, checkOut: string) {
    return this.request<{ success: boolean; available: boolean; reason?: string }>(
      `/properties/${propertyId}/availability?checkIn=${checkIn}&checkOut=${checkOut}`
    );
  }

  // Property blackout dates (admin)
  async getPropertyBlackouts(propertyId: string) {
    return this.request<{ success: boolean; data: Array<{ id: string; date: string; reason?: string }> }>(
      `/properties/${propertyId}/blackouts`
    );
  }

  async addPropertyBlackouts(propertyId: string, dates: string[], reason?: string) {
    return this.request<{ success: boolean; data: any[] }>(
      `/properties/${propertyId}/blackouts`,
      { method: 'POST', body: JSON.stringify({ dates, reason }) }
    );
  }

  async removePropertyBlackouts(propertyId: string, dates: string[]) {
    return this.request<{ success: boolean; message: string }>(
      `/properties/${propertyId}/blackouts`,
      { method: 'DELETE', body: JSON.stringify({ dates }) }
    );
  }

  // Bookings endpoints
  async getBookings(params?: {
    status?: string;
    property?: string;
    verification?: string;
    page?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const queryString = queryParams.toString();
    const endpoint = `/bookings${queryString ? `?${queryString}` : ''}`;
    
    return this.request<{
      success: boolean;
      data: any[];
      total: number;
      page: number;
      pages: number;
    }>(endpoint);
  }

  async getBooking(id: string) {
    return this.request<{ success: boolean; data: any }>(`/bookings/${id}`);
  }

  async createBooking(data: {
    property: string;
    checkIn: string;
    checkOut: string;
    numberOfGuests: number;
    specialRequests?: string;
  }) {
    return this.request<{ success: boolean; data: any }>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async confirmBooking(id: string) {
    return this.request<{ success: boolean; data: any }>(`/bookings/${id}/confirm`, {
      method: 'PUT',
    });
  }

  async cancelBooking(id: string, reason?: string) {
    return this.request<{ success: boolean; data: any }>(`/bookings/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async completeBooking(id: string) {
    return this.request<{ success: boolean; data: any }>(`/bookings/${id}/complete`, {
      method: 'PUT',
    });
  }

  async verifyBooking(id: string, status: 'approved' | 'rejected' | 'pending') {
    return this.request<{ success: boolean; data: any }>(`/bookings/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async uploadBookingIdProofs(bookingId: string, files: File[]) {
    const token = await getAuthToken();
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const response = await fetch(`${this.baseURL}/bookings/${bookingId}/id-proofs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse(response);
  }

  // Payment endpoints
  async createPaymentIntent(bookingId: string) {
    return this.request<{
      success: boolean;
      clientSecret: string | null;
      amount: number;
      booking: any;
      mode?: 'manual';
    }>('/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ bookingId }),
    });
  }

  async confirmPayment(bookingId: string, paymentIntentId: string, _unused?: any, extra?: { referenceId?: string; amount?: number }) {
    return this.request<{ success: boolean; message: string; data: any }>('/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ bookingId, paymentIntentId, referenceId: extra?.referenceId, amount: extra?.amount }),
    });
  }

  async getPaymentDetails(bookingId: string) {
    return this.request<{ success: boolean; data: any }>(`/payments/booking/${bookingId}`);
  }

  // Upload endpoints
  async uploadImage(file: File) {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${this.baseURL}/upload/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    return handleResponse(response);
  }

  async uploadImages(files: File[]) {
    const token = await getAuthToken();
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });

    const response = await fetch(`${this.baseURL}/upload/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    return handleResponse(response);
  }

  async uploadVideos(files: File[]) {
    const token = await getAuthToken();
    const formData = new FormData();
    files.forEach(file => {
      // Reuse images endpoint; backend now accepts video/* via fileFilter
      formData.append('images', file);
    });

    const response = await fetch(`${this.baseURL}/upload/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    return handleResponse(response);
  }

  async deleteImage(filename: string) {
    return this.request<{ success: boolean; message: string }>(`/upload/image/${filename}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;

