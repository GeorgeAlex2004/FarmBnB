import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Calendar, DollarSign, Users } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const { data: propertiesResponse } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => api.getProperties({}),
  });

  const { data: bookingsResponse } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => api.getBookings({}),
  });

  const properties = propertiesResponse?.data || [];
  const bookings = bookingsResponse?.data || [];

  // Deduplicate bookings: keep only the most recent booking for each unique combination
  const deduplicatedBookings = useMemo(() => {
    const seen = new Map<string, any>();
    
    // Sort by created_at descending to keep the most recent booking
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
      
      // Create a unique key for this booking combination
      const key = `${propertyId}_${customerId}_${checkIn}_${checkOut}`;
      
      // Only keep the first (most recent) booking for this combination
      if (!seen.has(key)) {
        seen.set(key, booking);
      }
    }
    
    return Array.from(seen.values());
  }, [bookings]);

  const stats = {
    properties: properties.length,
    bookings: deduplicatedBookings.length,
    revenue: deduplicatedBookings
      .filter((b: any) => b.status === "confirmed" || b.status === "completed")
      .reduce((sum: number, b: any) => sum + (b.total_amount || b.pricing?.totalAmount || 0), 0),
    pending: deduplicatedBookings.filter((b: any) => b.status === "pending").length,
  };

  const recentBookings = deduplicatedBookings
    .sort((a: any, b: any) => 
      new Date(b.created_at || b.createdAt || 0).getTime() - 
      new Date(a.created_at || a.createdAt || 0).getTime()
    )
    .slice(0, 5);

  const statCards = [
    {
      title: "Total Properties",
      value: stats.properties,
      icon: Building,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Total Bookings",
      value: stats.bookings,
      icon: Calendar,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Revenue",
      value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(stats.revenue),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Pending Bookings",
      value: stats.pending,
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your FarmBnB business
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card 
            key={stat.title} 
            className="hover-lift animate-fade-in shadow-soft"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-soft animate-scale-in">
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookings.length > 0 ? (
            <div className="space-y-4">
              {recentBookings.map((booking: any) => {
                const property = booking.property;
                const customer = booking.customer;
                const propertyName = booking.property_name || (typeof property === 'object' ? property?.name : null) || 'Unknown';
                const customerName = booking.customer_name || (typeof customer === 'object' ? customer?.name : null) || 'Guest';
                const bookingId = booking.id || booking._id;
                
                return (
                  <Link
                    key={bookingId}
                    to={bookingId ? `/admin/bookings?selected=${bookingId}` : '/admin/bookings'}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-semibold">{propertyName}</p>
                      <p className="text-sm text-muted-foreground">{customerName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(booking.checkIn || booking.check_in_date), "MMM dd, yyyy")} - {" "}
                        {format(new Date(booking.checkOut || booking.check_out_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(booking.pricing?.totalAmount || booking.total_amount || 0))}
                      </p>
                      <p
                        className={`text-sm ${
                          booking.status === "confirmed"
                            ? "text-green-600"
                            : booking.status === "pending"
                            ? "text-orange-600"
                            : booking.status === "cancelled"
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {booking.status}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No bookings yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
