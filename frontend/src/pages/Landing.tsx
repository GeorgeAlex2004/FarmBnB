import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyCard } from "@/components/PropertyCard";
import { Search, Calendar, Users as UsersIcon, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Landing = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [searchLocation, setSearchLocation] = useState("");

  // Redirect admins to admin dashboard
  useEffect(() => {
    if (!loading && isAdmin) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [loading, isAdmin, navigate]);

  const { data: propertiesResponse, isLoading } = useQuery({
    queryKey: ["featured-properties"],
    queryFn: async () => {
      const response = await api.getProperties({ limit: 6 });
      return response;
    },
  });

  // After hooks are declared, optionally short-circuit rendering for admins
  if (!loading && isAdmin) {
    return null;
  }

  const handleSearch = () => {
    navigate(`/properties?search=${searchLocation}`);
  };

  const properties = propertiesResponse?.data || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative bg-gradient-hero text-primary-foreground py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-sm">
              <Sparkles className="h-4 w-4" />
              <span>Discover Farm Stays</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 animate-slide-in">
              Find Your Perfect<br />
              <span className="text-white/90">Farm Getaway</span>
            </h1>
            <p className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-4 text-white/95 animate-fade-in delay-100 italic">
              Live a day the farm way
            </p>
            <p className="text-xl md:text-2xl opacity-90 max-w-2xl mx-auto animate-fade-in delay-200">
              Experience rustic charm and peaceful countryside living
            </p>
          </div>

          {/* Search Bar */}
          <div className="bg-card/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 md:p-8 max-w-4xl mx-auto animate-scale-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Where to?"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="pl-10 h-12 border-2 text-foreground placeholder:text-muted-foreground"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  className="pl-10 h-12 border-2 text-foreground"
                />
              </div>
              <div className="relative">
                <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  defaultValue="2"
                  className="pl-10 h-12 border-2 text-foreground"
                />
              </div>
            </div>
            <Button
              onClick={handleSearch}
              className="w-full mt-4 h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              Search Properties
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
              Featured Properties
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Hand-picked farm stays for an unforgettable experience
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-80 bg-muted animate-pulse rounded-xl"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property: any, index: number) => (
                <div key={property._id || property.id} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <PropertyCard
                    id={property._id || property.id}
                    name={property.name}
                    location={property.location?.address || property.location || 'Location'}
                    city={property.location?.city}
                    basePricePerNight={Number(property.pricing?.basePrice ?? property.basePricePerNight ?? property.base_price_per_night ?? 0)}
                    maxGuests={Number(property.capacity?.maxGuests ?? property.maxGuests ?? property.max_guests ?? 1)}
                    images={property.images?.map((img: any) =>
                      typeof img === 'string' ? img : (img.url || img)
                    ) || []}
                    facilities={property.facilities?.map((f: any) =>
                      typeof f === 'string' ? f : f.name
                    ) || []}
                  />
                </div>
              ))}
            </div>
          )}

          {!isLoading && properties.length === 0 && (
            <div className="text-center py-12">
              <p className="text-xl text-muted-foreground">
                No properties available yet. Check back soon!
              </p>
            </div>
          )}

          {properties.length > 0 && (
            <div className="text-center mt-12">
              <Button 
                onClick={() => navigate('/properties')}
                variant="outline"
                size="lg"
                className="px-8"
              >
                View All Properties
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-12 px-4 mt-16">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground mb-2">
            &copy; {new Date().getFullYear()} FarmBnB. All rights reserved.
          </p>
          <p className="text-lg font-semibold text-foreground mb-2 italic">
            Live a day the farm way
          </p>
          <p className="text-sm text-muted-foreground">
            Experience the best of farm life
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
