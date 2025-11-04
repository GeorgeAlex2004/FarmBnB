import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const AdminProperties = () => {
  const queryClient = useQueryClient();

  const { data: propertiesResponse, isLoading } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: async () => {
      // Admin should see all properties (active and inactive)
      const response = await api.getProperties({ status: 'all' });
      return response;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteProperty(id);
    },
    onSuccess: () => {
      toast.success("Property deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete property");
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return;
    deleteMutation.mutate(id);
  };

  const properties = propertiesResponse?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Properties</h1>
          <p className="text-muted-foreground">
            Manage your property listings
          </p>
        </div>
        <Link to="/admin/properties/new">
          <Button className="gap-2 shadow-soft hover:shadow-medium transition-all">
            <Plus className="h-5 w-5" />
            Add Property
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : properties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property: any, index: number) => {
            const images = property.images?.map((img: any) =>
              typeof img === 'string' ? img : (img?.url || img)
            ) || [];
            const displayImage = images[0] || "/placeholder.svg";
            const isActive = property.is_active === true;
            const priceValue = property.base_price_per_night ?? property.pricing?.basePrice ?? 0;
            
            return (
              <Card 
                key={property._id || property.id} 
                className="overflow-hidden hover-lift animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="aspect-[4/3] relative">
                  <Link to={`/properties/${property._id || property.id}`}>
                    <img
                      src={displayImage}
                      alt={property.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <Badge
                    className={`absolute top-2 right-2 ${
                      isActive
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-gray-500 hover:bg-gray-600"
                    }`}
                  >
                    {isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <Link to={`/properties/${property._id || property.id}`}>
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1">
                      {property.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-4 w-4" />
                    <span className="line-clamp-1">
                      {property.location?.city || property.location?.address || property.location || 'Location'}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-primary mb-4">
                    ₹{Number(priceValue || 0).toLocaleString('en-IN')}/night
                  </p>
                  <div className="flex gap-2">
                    <Link
                      to={`/admin/properties/edit/${property._id || property.id}`}
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full gap-2">
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(property._id || property.id)}
                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center shadow-soft">
          <p className="text-muted-foreground mb-4">
            No properties yet. Add your first property to get started!
          </p>
          <Link to="/admin/properties/new">
            <Button className="gap-2">
              <Plus className="h-5 w-5" />
              Add Property
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
};

export default AdminProperties;
