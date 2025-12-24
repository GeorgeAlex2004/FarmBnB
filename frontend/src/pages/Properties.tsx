import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PropertyCard } from "@/components/PropertyCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

const commonFacilities = [
  "WiFi",
  "Parking",
  "Kitchen",
  "Pool",
  "Pet-friendly",
  "Air Conditioning",
  "Heating",
];

const Properties = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [priceRange, setPriceRange] = useState([1000, 10000]);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: propertiesResponse, isLoading } = useQuery({
    queryKey: ["properties", searchQuery, priceRange, selectedFacilities],
    queryFn: async () => {
      let q = supabase
        .from('properties')
        .select('*')
        .gte('base_price_per_night', priceRange[0])
        .lte('base_price_per_night', priceRange[1]);
      if (searchQuery) {
        q = q.ilike('name', `%${searchQuery}%`);
      }
      if (selectedFacilities.length > 0) {
        // assuming facilities is a text[] column; adjust if stored differently
        q = q.contains('facilities', selectedFacilities);
      }
      const { data, error } = await q;
      if (error) throw error;
      return { data: data || [], success: true } as any;
    },
  });

  const toggleFacility = (facility: string) => {
    setSelectedFacilities((prev) =>
      prev.includes(facility)
        ? prev.filter((f) => f !== facility)
        : [...prev, facility]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setPriceRange([1000, 10000]);
    setSelectedFacilities([]);
    setSearchParams({});
  };

  const properties = propertiesResponse?.data || [];
  const hasActiveFilters = searchQuery || priceRange[0] > 1000 || priceRange[1] < 10000 || selectedFacilities.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
            Browse Properties
          </h1>
          <p className="text-xl md:text-2xl font-semibold text-primary italic mb-6">
            Live a day the farm way
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by location or property name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 border-2"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2 h-12"
            >
              <SlidersHorizontal className="h-5 w-5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                  {selectedFacilities.length + (priceRange[0] > 0 || priceRange[1] < 1000 ? 1 : 0)}
                </span>
              )}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="gap-2 h-12"
              >
                <X className="h-5 w-5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside
            className={`lg:w-64 space-y-6 transition-all ${showFilters ? "block" : "hidden lg:block"}`}
          >
            <Card className="p-6 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Price Range</h3>
                {priceRange[0] > 1000 || priceRange[1] < 10000 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPriceRange([1000, 10000])}
                    className="h-6 px-2 text-xs"
                  >
                    Reset
                  </Button>
                ) : null}
              </div>
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                max={10000}
                step={100}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(priceRange[0])}</span>
                <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(priceRange[1])}</span>
              </div>
            </Card>

            <Card className="p-6 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Facilities</h3>
                {selectedFacilities.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFacilities([])}
                    className="h-6 px-2 text-xs"
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              <div className="space-y-3">
                {commonFacilities.map((facility) => (
                  <div key={facility} className="flex items-center gap-2">
                    <Checkbox
                      id={facility}
                      checked={selectedFacilities.includes(facility)}
                      onCheckedChange={() => toggleFacility(facility)}
                    />
                    <label
                      htmlFor={facility}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {facility}
                    </label>
                  </div>
                ))}
              </div>
            </Card>
          </aside>

          {/* Properties Grid */}
          <main className="flex-1">
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
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {properties.length}
                    </span>{" "}
                    {properties.length === 1 ? "property" : "properties"} found
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.map((property: any, index: number) => (
                    <div key={property._id || property.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
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
              </>
            )}

            {!isLoading && properties.length === 0 && (
              <Card className="p-12 text-center shadow-soft">
                <p className="text-xl text-muted-foreground mb-4">
                  No properties match your filters.
                </p>
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Properties;
