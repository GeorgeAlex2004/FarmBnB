import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, TrendingUp, DollarSign, Calendar, Users, Star, BarChart3, Sparkles } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay, differenceInDays, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const Analytics = () => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");

  const { data: propertiesResponse } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => api.getProperties({ status: "all" }),
  });

  const { data: bookingsResponse } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => api.getBookings({}),
  });

  const properties = propertiesResponse?.data || [];
  const bookings = bookingsResponse?.data || [];

  // Deduplicate bookings
  const deduplicatedBookings = useMemo(() => {
    const seen = new Map<string, any>();
    const sorted = [...bookings].sort((a: any, b: any) => {
      const aDate = new Date(a.created_at || a.createdAt || 0).getTime();
      const bDate = new Date(b.created_at || b.createdAt || 0).getTime();
      return bDate - aDate;
    });
    
    for (const booking of sorted) {
      const propertyId = typeof booking.property === 'object' 
        ? (booking.property?._id || booking.property?.id || '')
        : (booking.property_id || booking.property || '');
      const customerId = typeof booking.customer === 'object'
        ? (booking.customer?._id || booking.customer?.id || '')
        : (booking.customer_id || booking.customer || '');
      const checkIn = booking.check_in_date || booking.checkIn || '';
      const checkOut = booking.check_out_date || booking.checkOut || '';
      
      const key = `${propertyId}_${customerId}_${checkIn}_${checkOut}`;
      if (!seen.has(key)) {
        seen.set(key, booking);
      }
    }
    
    return Array.from(seen.values());
  }, [bookings]);

  // Filter bookings by selected property
  const filteredBookings = useMemo(() => {
    if (selectedPropertyId === "all") return deduplicatedBookings;
    return deduplicatedBookings.filter((booking: any) => {
      const propertyId = typeof booking.property === 'object' 
        ? (booking.property?._id || booking.property?.id || '')
        : (booking.property_id || booking.property || '');
      return propertyId === selectedPropertyId;
    });
  }, [deduplicatedBookings, selectedPropertyId]);

  // Calculate property analytics
  const propertyAnalytics = useMemo(() => {
    const analytics = new Map<string, {
      property: any;
      totalBookings: number;
      confirmedBookings: number;
      totalRevenue: number;
      averageBookingValue: number;
      occupancyRate: number;
      totalNights: number;
      cancelledBookings: number;
    }>();

    // Initialize all properties
    properties.forEach((prop: any) => {
      const propId = prop.id || prop._id;
      analytics.set(propId, {
        property: prop,
        totalBookings: 0,
        confirmedBookings: 0,
        totalRevenue: 0,
        averageBookingValue: 0,
        occupancyRate: 0,
        totalNights: 0,
        cancelledBookings: 0,
      });
    });

    // Process bookings
    deduplicatedBookings.forEach((booking: any) => {
      const propertyId = typeof booking.property === 'object' 
        ? (booking.property?._id || booking.property?.id || '')
        : (booking.property_id || booking.property || '');
      
      if (!propertyId || !analytics.has(propertyId)) return;

      const stats = analytics.get(propertyId)!;
      const amount = Number(booking.total_amount || booking.pricing?.totalAmount || 0);
      const status = (booking.status || '').toLowerCase();
      
      stats.totalBookings++;
      
      if (status === 'cancelled') {
        stats.cancelledBookings++;
      } else if (status === 'confirmed' || status === 'completed') {
        stats.confirmedBookings++;
        stats.totalRevenue += amount;
      }

      // Calculate nights
      const checkIn = booking.check_in_date || booking.checkIn;
      const checkOut = booking.check_out_date || booking.checkOut;
      if (checkIn && checkOut) {
        const checkInDate = parseISO(checkIn);
        const checkOutDate = parseISO(checkOut);
        const nights = Math.max(1, differenceInDays(checkOutDate, checkInDate) + 1);
        if (nights > 0) {
          stats.totalNights += nights;
        }
      }
    });

    // Calculate averages and occupancy
    analytics.forEach((stats, propId) => {
      if (stats.confirmedBookings > 0) {
        stats.averageBookingValue = stats.totalRevenue / stats.confirmedBookings;
      }
    });

    return Array.from(analytics.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [properties, deduplicatedBookings]);

  // Get selected property analytics
  const selectedPropertyStats = useMemo(() => {
    if (selectedPropertyId === "all") {
      return propertyAnalytics.reduce((acc, stat) => ({
        totalBookings: acc.totalBookings + stat.totalBookings,
        confirmedBookings: acc.confirmedBookings + stat.confirmedBookings,
        totalRevenue: acc.totalRevenue + stat.totalRevenue,
        totalNights: acc.totalNights + stat.totalNights,
        cancelledBookings: acc.cancelledBookings + stat.cancelledBookings,
      }), {
        totalBookings: 0,
        confirmedBookings: 0,
        totalRevenue: 0,
        totalNights: 0,
        cancelledBookings: 0,
      }) as { totalBookings: number; confirmedBookings: number; totalRevenue: number; totalNights: number; cancelledBookings: number; property?: never };
    }
    return propertyAnalytics.find(stat => (stat.property?.id || stat.property?._id) === selectedPropertyId) as typeof propertyAnalytics[0] | undefined;
  }, [propertyAnalytics, selectedPropertyId]);

  // Overall statistics
  const overallStats = useMemo(() => {
    const activeProperties = properties.filter((p: any) => p.is_active !== false).length;
    const inactiveProperties = properties.length - activeProperties;
    const totalRevenue = propertyAnalytics.reduce((sum, stat) => sum + stat.totalRevenue, 0);
    const totalBookings = deduplicatedBookings.length;
    const confirmedBookings = deduplicatedBookings.filter((b: any) => 
      ['confirmed', 'completed'].includes((b.status || '').toLowerCase())
    ).length;
    const averageRevenuePerProperty = propertyAnalytics.length > 0 
      ? totalRevenue / propertyAnalytics.length 
      : 0;

    return {
      activeProperties,
      inactiveProperties,
      totalProperties: properties.length,
      totalRevenue,
      totalBookings,
      confirmedBookings,
      averageRevenuePerProperty,
    };
  }, [properties, propertyAnalytics, deduplicatedBookings]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Prepare chart data for selected property or all
  const revenueByPropertyData = useMemo(() => {
    if (selectedPropertyId === "all") {
      return propertyAnalytics
        .filter(stat => stat.totalRevenue > 0)
        .map(stat => ({
          name: stat.property?.name || 'Unknown',
          revenue: stat.totalRevenue,
          bookings: stat.confirmedBookings,
        }))
        .slice(0, 10);
    } else {
      // For single property, show monthly breakdown
      const last12Months = Array.from({ length: 12 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (11 - i));
        return {
          name: format(date, 'MMM yyyy'),
          revenue: 0,
          bookings: 0,
        };
      });

      filteredBookings
        .filter((b: any) => ['confirmed', 'completed'].includes((b.status || '').toLowerCase()))
        .forEach((booking: any) => {
          const bookingDate = new Date(booking.created_at || booking.createdAt || Date.now());
          const monthKey = format(bookingDate, 'MMM yyyy');
          const amount = Number(booking.total_amount || 0);
          
          const monthData = last12Months.find(d => d.name === monthKey);
          if (monthData) {
            monthData.revenue += amount;
            monthData.bookings += 1;
          }
        });

      return last12Months;
    }
  }, [propertyAnalytics, selectedPropertyId, filteredBookings]);

  const revenueOverTimeData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      return {
        date: format(date, 'MMM dd'),
        revenue: 0,
      };
    });

    filteredBookings
      .filter((b: any) => ['confirmed', 'completed'].includes((b.status || '').toLowerCase()))
      .forEach((booking: any) => {
        const bookingDate = new Date(booking.created_at || booking.createdAt || Date.now());
        const dateKey = format(startOfDay(bookingDate), 'MMM dd');
        const amount = Number(booking.total_amount || booking.pricing?.totalAmount || 0);
        
        const dayData = last30Days.find(d => d.date === dateKey);
        if (dayData) {
          dayData.revenue += amount;
        }
      });

    return last30Days;
  }, [filteredBookings]);

  // Booking status distribution for pie chart
  const bookingStatusData = useMemo(() => {
    const statusCounts = {
      confirmed: 0,
      pending: 0,
      cancelled: 0,
      completed: 0,
    };

    filteredBookings.forEach((booking: any) => {
      const status = (booking.status || '').toLowerCase();
      if (status === 'confirmed') statusCounts.confirmed++;
      else if (status === 'cancelled') statusCounts.cancelled++;
      else if (status === 'completed') statusCounts.completed++;
      else statusCounts.pending++;
    });

    return [
      { name: 'Confirmed', value: statusCounts.confirmed, color: '#10b981' },
      { name: 'Pending', value: statusCounts.pending, color: '#f59e0b' },
      { name: 'Cancelled', value: statusCounts.cancelled, color: '#ef4444' },
      { name: 'Completed', value: statusCounts.completed, color: '#3b82f6' },
    ].filter(item => item.value > 0);
  }, [filteredBookings]);

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))",
    },
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const selectedProperty = selectedPropertyId !== "all" 
    ? properties.find((p: any) => (p.id || p._id) === selectedPropertyId)
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Property Analytics
          </h1>
          <p className="text-muted-foreground">
            {selectedPropertyId === "all" 
              ? "Comprehensive insights into all properties" 
              : `Detailed analytics for ${selectedProperty?.name || 'selected property'}`}
          </p>
        </div>
        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
          <SelectTrigger className="w-[250px] bg-card border-2">
            <SelectValue placeholder="Select a property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((prop: any) => (
              <SelectItem key={prop.id || prop._id} value={prop.id || prop._id}>
                {prop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overall Stats - Colorful Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Total Properties</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
              <Building className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{overallStats.totalProperties}</div>
            <p className="text-xs text-blue-700 mt-1">
              {overallStats.activeProperties} active, {overallStats.inactiveProperties} inactive
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Total Revenue</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              {selectedPropertyStats 
                ? formatCurrency(selectedPropertyStats.totalRevenue)
                : formatCurrency(overallStats.totalRevenue)}
            </div>
            <p className="text-xs text-green-700 mt-1">
              {selectedPropertyStats 
                ? `${selectedPropertyStats.confirmedBookings} confirmed bookings`
                : `Avg: ${formatCurrency(overallStats.averageRevenuePerProperty)} per property`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Total Bookings</CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">
              {selectedPropertyStats 
                ? selectedPropertyStats.totalBookings
                : overallStats.totalBookings}
            </div>
            <p className="text-xs text-purple-700 mt-1">
              {selectedPropertyStats 
                ? `${selectedPropertyStats.confirmedBookings} confirmed`
                : `${overallStats.confirmedBookings} confirmed`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Avg Booking Value</CardTitle>
            <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">
              {selectedPropertyStats && selectedPropertyStats.confirmedBookings > 0
                ? formatCurrency(selectedPropertyStats.totalRevenue / selectedPropertyStats.confirmedBookings)
                : selectedPropertyStats
                ? formatCurrency(0)
                : formatCurrency(overallStats.averageRevenuePerProperty)}
            </div>
            <p className="text-xs text-orange-700 mt-1">
              {selectedPropertyStats ? "Per confirmed booking" : "Across all properties"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Property-Specific Stats (when property selected) */}
      {selectedPropertyStats && selectedPropertyId !== "all" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-cyan-900">Total Nights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-900">{selectedPropertyStats.totalNights}</div>
              <p className="text-xs text-cyan-700 mt-1">Nights booked</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-pink-900">Cancelled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-900">{selectedPropertyStats.cancelledBookings}</div>
              <p className="text-xs text-pink-700 mt-1">Cancelled bookings</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-indigo-900">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-900">
                {selectedPropertyStats.totalBookings > 0
                  ? Math.round((selectedPropertyStats.confirmedBookings / selectedPropertyStats.totalBookings) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-indigo-700 mt-1">Confirmation rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Chart */}
            <Card className="border-2 hover:shadow-xl transition-shadow">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  {selectedPropertyId === "all" ? "Revenue by Property" : "Monthly Revenue"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {revenueByPropertyData.length > 0 && revenueByPropertyData.some(d => d.revenue > 0) ? (
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <BarChart data={revenueByPropertyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="name" 
                        angle={selectedPropertyId === "all" ? -45 : 0}
                        textAnchor={selectedPropertyId === "all" ? "end" : "middle"}
                        height={selectedPropertyId === "all" ? 80 : 40}
                        fontSize={11}
                        tick={{ fill: '#6b7280' }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        fontSize={11}
                        width={60}
                        tick={{ fill: '#6b7280' }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} 
                      />
                      <Bar 
                        dataKey="revenue" 
                        fill="url(#colorRevenue)" 
                        radius={[8, 8, 0, 0]}
                        className="hover:opacity-80 transition-opacity"
                      />
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No revenue data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue Over Time */}
            <Card className="border-2 hover:shadow-xl transition-shadow">
              <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Revenue Over Time (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {revenueOverTimeData.some(d => d.revenue > 0) ? (
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <LineChart data={revenueOverTimeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" fontSize={11} tick={{ fill: '#6b7280' }} />
                      <YAxis 
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        fontSize={11}
                        width={60}
                        tick={{ fill: '#6b7280' }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="url(#colorLine)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#10b981' }}
                        activeDot={{ r: 6, fill: '#059669' }}
                      />
                      <defs>
                        <linearGradient id="colorLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#059669" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No revenue data for the last 30 days</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Booking Status Distribution */}
            <Card className="border-2 hover:shadow-xl transition-shadow">
              <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Booking Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {bookingStatusData.length > 0 ? (
                  <div className="space-y-4">
                    <ChartContainer config={chartConfig} className="h-[250px]">
                      <PieChart>
                        <Pie
                          data={bookingStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {bookingStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip />
                      </PieChart>
                    </ChartContainer>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {bookingStatusData.map((item, index) => (
                        <Badge key={index} variant="outline" className="px-3 py-1">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                          {item.name}: {item.value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No booking data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Properties */}
            <Card className="border-2 hover:shadow-xl transition-shadow">
              <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-600" />
                  {selectedPropertyId === "all" ? "Top Revenue Generators" : "Booking Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {selectedPropertyId === "all" ? (
                  <div className="space-y-3">
                    {propertyAnalytics
                      .filter(stat => stat.totalRevenue > 0)
                      .slice(0, 5)
                      .map((stat, index) => (
                        <div key={stat.property?.id || stat.property?._id || index} 
                             className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 hover:shadow-md transition-all border border-amber-200">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold shadow-lg">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{stat.property?.name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">
                                {stat.confirmedBookings} confirmed bookings
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-amber-700">{formatCurrency(stat.totalRevenue)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(stat.averageBookingValue)} avg
                            </div>
                          </div>
                        </div>
                      ))}
                    {propertyAnalytics.filter(stat => stat.totalRevenue > 0).length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No revenue data available</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                        <div className="text-sm text-blue-700 font-medium mb-1">Total Bookings</div>
                        <div className="text-2xl font-bold text-blue-900">{selectedPropertyStats.totalBookings}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
                        <div className="text-sm text-green-700 font-medium mb-1">Confirmed</div>
                        <div className="text-2xl font-bold text-green-900">{selectedPropertyStats.confirmedBookings}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
                        <div className="text-sm text-purple-700 font-medium mb-1">Total Nights</div>
                        <div className="text-2xl font-bold text-purple-900">{selectedPropertyStats.totalNights}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
                        <div className="text-sm text-red-700 font-medium mb-1">Cancelled</div>
                        <div className="text-2xl font-bold text-red-900">{selectedPropertyStats.cancelledBookings}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          {/* Property Performance Table */}
          <Card className="border-2 hover:shadow-xl transition-shadow">
            <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                Property Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-muted">
                      <th className="text-left p-3 font-semibold text-foreground">Property</th>
                      <th className="text-center p-3 font-semibold text-foreground">Status</th>
                      <th className="text-right p-3 font-semibold text-foreground">Total Bookings</th>
                      <th className="text-right p-3 font-semibold text-foreground">Confirmed</th>
                      <th className="text-right p-3 font-semibold text-foreground">Total Revenue</th>
                      <th className="text-right p-3 font-semibold text-foreground">Avg Booking Value</th>
                      <th className="text-right p-3 font-semibold text-foreground">Total Nights</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPropertyId === "all" ? (
                      propertyAnalytics.length > 0 ? (
                        propertyAnalytics.map((stat, index) => (
                          <tr key={stat?.property?.id || stat?.property?._id || index} 
                              className="border-b hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-foreground">{stat?.property?.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">
                                {stat?.property?.city || ''} {stat?.property?.state ? `, ${stat?.property.state}` : ''}
                              </div>
                            </td>
                            <td className="text-center p-3">
                              <Badge 
                                className={
                                  stat?.property?.is_active !== false
                                    ? 'bg-green-100 text-green-800 border-green-300'
                                    : 'bg-gray-100 text-gray-800 border-gray-300'
                                }
                              >
                                {stat?.property?.is_active !== false ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="text-right p-3 font-medium">{stat?.totalBookings || 0}</td>
                            <td className="text-right p-3">
                              <span className="font-semibold text-green-700">{stat?.confirmedBookings || 0}</span>
                            </td>
                            <td className="text-right p-3">
                              <span className="font-bold text-primary">{formatCurrency(stat?.totalRevenue || 0)}</span>
                            </td>
                            <td className="text-right p-3 text-muted-foreground">{formatCurrency(stat?.averageBookingValue || 0)}</td>
                            <td className="text-right p-3 font-medium">{stat?.totalNights || 0}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center p-8 text-muted-foreground">
                            No property data available
                          </td>
                        </tr>
                      )
                    ) : selectedPropertyStats && selectedPropertyId !== "all" ? (
                      <tr className="border-b hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{(selectedPropertyStats as any)?.property?.name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">
                            {(selectedPropertyStats as any)?.property?.city || ''} {(selectedPropertyStats as any)?.property?.state ? `, ${(selectedPropertyStats as any).property.state}` : ''}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <Badge 
                            className={
                              (selectedPropertyStats as any)?.property?.is_active !== false
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : 'bg-gray-100 text-gray-800 border-gray-300'
                            }
                          >
                            {(selectedPropertyStats as any)?.property?.is_active !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-right p-3 font-medium">{selectedPropertyStats.totalBookings || 0}</td>
                        <td className="text-right p-3">
                          <span className="font-semibold text-green-700">{selectedPropertyStats.confirmedBookings || 0}</span>
                        </td>
                        <td className="text-right p-3">
                          <span className="font-bold text-primary">{formatCurrency(selectedPropertyStats.totalRevenue || 0)}</span>
                        </td>
                        <td className="text-right p-3 text-muted-foreground">
                          {formatCurrency(
                            selectedPropertyStats.confirmedBookings > 0
                              ? (selectedPropertyStats.totalRevenue || 0) / selectedPropertyStats.confirmedBookings
                              : 0
                          )}
                        </td>
                        <td className="text-right p-3 font-medium">{selectedPropertyStats.totalNights || 0}</td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-muted-foreground">
                          No property data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
