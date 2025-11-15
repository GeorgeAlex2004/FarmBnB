import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

const Analytics = () => {
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
      
      if (status === 'confirmed' || status === 'completed') {
        stats.confirmedBookings++;
        stats.totalRevenue += amount;
      }

      // Calculate nights
      const checkIn = booking.check_in_date || booking.checkIn;
      const checkOut = booking.check_out_date || booking.checkOut;
      if (checkIn && checkOut) {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
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
      
      // Simple occupancy rate: (total nights booked / days in last 90 days) * 100
      // For simplicity, we'll use a rough estimate based on bookings
      const daysInPeriod = 90;
      const maxPossibleNights = daysInPeriod * (stats.property?.max_guests || 1);
      if (maxPossibleNights > 0) {
        stats.occupancyRate = Math.min(100, (stats.totalNights / maxPossibleNights) * 100);
      }
    });

    return Array.from(analytics.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [properties, deduplicatedBookings]);

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

  // Prepare chart data
  const revenueByPropertyData = useMemo(() => {
    return propertyAnalytics
      .filter(stat => stat.totalRevenue > 0)
      .map(stat => ({
        name: stat.property?.name || 'Unknown',
        revenue: stat.totalRevenue,
        bookings: stat.confirmedBookings,
      }))
      .slice(0, 10); // Top 10 properties
  }, [propertyAnalytics]);

  const revenueOverTimeData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      return {
        date: format(date, 'MMM dd'),
        revenue: 0,
      };
    });

    deduplicatedBookings
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
  }, [deduplicatedBookings]);

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Property Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive insights into your property performance
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalProperties}</div>
            <p className="text-xs text-muted-foreground">
              {overallStats.activeProperties} active, {overallStats.inactiveProperties} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overallStats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(overallStats.averageRevenuePerProperty)} per property
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {overallStats.confirmedBookings} confirmed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Revenue/Property</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overallStats.averageRevenuePerProperty)}</div>
            <p className="text-xs text-muted-foreground">
              Across all properties
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue by Property */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Revenue by Property</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByPropertyData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px]">
                <BarChart data={revenueByPropertyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={10}
                  />
                  <YAxis 
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    fontSize={10}
                    width={50}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} 
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Over Time */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Revenue Over Time (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueOverTimeData.some(d => d.revenue > 0) ? (
              <ChartContainer config={chartConfig} className="h-[250px]">
                <LineChart data={revenueOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={10} />
                  <YAxis 
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    fontSize={10}
                    width={50}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="var(--color-revenue)" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No revenue data for the last 30 days
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Property Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Property Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Property</th>
                  <th className="text-right p-2 font-medium">Status</th>
                  <th className="text-right p-2 font-medium">Total Bookings</th>
                  <th className="text-right p-2 font-medium">Confirmed</th>
                  <th className="text-right p-2 font-medium">Total Revenue</th>
                  <th className="text-right p-2 font-medium">Avg Booking Value</th>
                  <th className="text-right p-2 font-medium">Total Nights</th>
                </tr>
              </thead>
              <tbody>
                {propertyAnalytics.length > 0 ? (
                  propertyAnalytics.map((stat, index) => (
                    <tr key={stat.property?.id || stat.property?._id || index} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div className="font-medium">{stat.property?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">
                          {stat.property?.city || ''} {stat.property?.state ? `, ${stat.property.state}` : ''}
                        </div>
                      </td>
                      <td className="text-right p-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          stat.property?.is_active !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {stat.property?.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right p-2">{stat.totalBookings}</td>
                      <td className="text-right p-2">{stat.confirmedBookings}</td>
                      <td className="text-right p-2 font-semibold">{formatCurrency(stat.totalRevenue)}</td>
                      <td className="text-right p-2">{formatCurrency(stat.averageBookingValue)}</td>
                      <td className="text-right p-2">{stat.totalNights}</td>
                    </tr>
                  ))
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

      {/* Top Performing Properties */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Revenue Generators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {propertyAnalytics
                .filter(stat => stat.totalRevenue > 0)
                .slice(0, 5)
                .map((stat, index) => (
                  <div key={stat.property?.id || stat.property?._id || index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{stat.property?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">
                          {stat.confirmedBookings} confirmed bookings
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(stat.totalRevenue)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(stat.averageBookingValue)} avg
                      </div>
                    </div>
                  </div>
                ))}
              {propertyAnalytics.filter(stat => stat.totalRevenue > 0).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No revenue data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Most Booked Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {propertyAnalytics
                .filter(stat => stat.totalBookings > 0)
                .sort((a, b) => b.totalBookings - a.totalBookings)
                .slice(0, 5)
                .map((stat, index) => (
                  <div key={stat.property?.id || stat.property?._id || index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{stat.property?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">
                          {stat.totalNights} total nights
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{stat.totalBookings} bookings</div>
                      <div className="text-sm text-muted-foreground">
                        {stat.confirmedBookings} confirmed
                      </div>
                    </div>
                  </div>
                ))}
              {propertyAnalytics.filter(stat => stat.totalBookings > 0).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No booking data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;

