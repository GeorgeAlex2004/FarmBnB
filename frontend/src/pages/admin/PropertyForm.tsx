import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Upload, X } from "lucide-react";
import { Link } from "react-router-dom";

const commonFacilities = [
  "WiFi",
  "Parking",
  "Kitchen",
  "Pool",
  "Pet-friendly",
  "Air Conditioning",
  "Heating",
  "Fireplace",
  "Garden",
  "BBQ",
];

const PropertyForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: {
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
    },
    googleMapsUrl: "",
    pricing: {
      basePrice: "",
      perHeadPrice: "",
      extraFees: {
        cleaningFee: "",
        serviceFee: "",
      },
    },
    capacity: {
      maxGuests: "",
    },
    facilities: [] as string[],
    images: [] as Array<{ url: string; filename?: string; isPrimary?: boolean }>,
    videos: [] as string[],
    status: "draft" as "active" | "inactive" | "draft",
    availability: {
      isAvailable: true,
    },
  });

  const [uploading, setUploading] = useState(false);

  const { data: propertyResponse, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.getProperty(id);
      return response.data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (propertyResponse) {
      const property = propertyResponse;
      setFormData({
        name: property.name || "",
        description: property.description || "",
        location: {
          address: property.location?.address || property.location || "",
          city: property.location?.city || "",
          state: property.location?.state || "",
          zipCode: property.location?.zipCode || "",
          country: property.location?.country || "USA",
        },
        googleMapsUrl: property.google_maps_url || property.googleMapsUrl || "",
        pricing: {
          basePrice: property.pricing?.basePrice?.toString() || property.basePricePerNight?.toString() || "",
          perHeadPrice: property.pricing?.perHeadPrice?.toString() || property.perHeadCharge?.toString() || "",
          extraFees: {
            cleaningFee: property.pricing?.extraFees?.cleaningFee?.toString() || property.cleaningFee?.toString() || "",
            serviceFee: property.pricing?.extraFees?.serviceFee?.toString() || property.serviceFee?.toString() || "",
          },
        },
        capacity: {
          maxGuests: property.capacity?.maxGuests?.toString() || property.maxGuests?.toString() || "",
        },
        facilities: property.facilities?.map((f: any) => typeof f === 'string' ? f : f.name) || [],
        images: property.images?.map((img: any) => ({
          url: typeof img === 'string' ? img : (img.url || img),
          filename: typeof img === 'string' ? undefined : img.filename,
          isPrimary: typeof img === 'string' ? false : img.isPrimary,
        })) || [],
        videos: (property.videos as string[] | undefined) || [],
        status: property.status || "draft",
        availability: {
          isAvailable: property.availability?.isAvailable ?? true,
        },
      });
    }
  }, [propertyResponse]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.createProperty(data);
    },
    onSuccess: () => {
      toast.success("Property created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
      navigate("/admin/properties");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create property");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!id) throw new Error("Property ID required");
      return api.updateProperty(id, data);
    },
    onSuccess: () => {
      toast.success("Property updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", id] });
      navigate("/admin/properties");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update property");
    },
  });

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const fileArray = Array.from(files);
      const result = await api.uploadImages(fileArray);
      const uploaded = (result.data || []) as Array<{ url: string; path?: string }>;
      const newImages = uploaded.map((img) => ({ url: img.url, filename: img.path, isPrimary: false }));
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
      toast.success(`Successfully uploaded ${newImages.length} image(s)`);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload images");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const fileArray = Array.from(files);
      const result = await api.uploadVideos(fileArray);
      const uploaded = (result.data || []) as Array<{ url: string }>;
      const newVideos: string[] = uploaded.map((u) => u.url);
      setFormData((prev) => ({ ...prev, videos: [...prev.videos, ...newVideos] }));
      toast.success(`Successfully uploaded ${newVideos.length} video(s)`);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload videos");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const setPrimaryImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => ({
        ...img,
        isPrimary: i === index,
      })),
    }));
  };

  const removeVideo = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const propertyData = {
      name: formData.name,
      description: formData.description,
      location: {
        address: formData.location.address,
        city: formData.location.city,
        state: formData.location.state,
        zipCode: formData.location.zipCode,
        country: formData.location.country,
      },
      googleMapsUrl: formData.googleMapsUrl,
      pricing: {
        basePrice: parseFloat(formData.pricing.basePrice),
        perHeadPrice: parseFloat(formData.pricing.perHeadPrice || "0"),
        extraFees: {
          cleaningFee: parseFloat(formData.pricing.extraFees.cleaningFee || "0"),
          serviceFee: parseFloat(formData.pricing.extraFees.serviceFee || "0"),
        },
      },
      capacity: {
        maxGuests: parseInt(formData.capacity.maxGuests),
      },
      facilities: formData.facilities.map((f) => ({ name: f })),
      images: formData.images.map((img) => ({
        url: img.url,
        filename: img.filename,
        isPrimary: img.isPrimary || false,
      })),
      videos: formData.videos,
      status: formData.status,
      availability: formData.availability,
    };

    if (isEditing) {
      updateMutation.mutate(propertyData);
    } else {
      createMutation.mutate(propertyData);
    }
  };

  const toggleFacility = (facility: string) => {
    setFormData((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter((f) => f !== facility)
        : [...prev.facilities, facility],
    }));
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/admin/properties">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Property" : "Add New Property"}
          </h1>
          <p className="text-muted-foreground">
            Fill in the details below to {isEditing ? "update" : "create"} a property
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Property Name *
              </label>
              <Input
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Beautiful Farmhouse Retreat"
              />
            </div>

            <div className="flex items-start gap-2">
              <label className="text-sm font-medium mb-1 block">
                Description
              </label>
              <div className="flex-1">
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe your property..."
                  rows={4}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Address *
                </label>
                <Input
                  required
                  value={formData.location.address}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: { ...formData.location, address: e.target.value },
                    })
                  }
                  placeholder="123 Farm Road"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">City *</label>
                <Input
                  required
                  value={formData.location.city}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: { ...formData.location, city: e.target.value },
                    })
                  }
                  placeholder="Springfield"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">State *</label>
                <Input
                  required
                  value={formData.location.state}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: { ...formData.location, state: e.target.value },
                    })
                  }
                  placeholder="CA"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Zip Code *
                </label>
                <Input
                  required
                  value={formData.location.zipCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: { ...formData.location, zipCode: e.target.value },
                    })
                  }
                  placeholder="12345"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Google Maps Link (Location) *
              </label>
              <Input
                required
                type="url"
                value={formData.googleMapsUrl}
                onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
                placeholder="https://maps.google.com/..."
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Maximum Guests *
              </label>
              <Input
                type="number"
                required
                min="1"
                value={formData.capacity.maxGuests}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    capacity: { ...formData.capacity, maxGuests: e.target.value },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Base Price per Night * (₹)
                </label>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.pricing.basePrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricing: { ...formData.pricing, basePrice: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Per Head Charge (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.pricing.perHeadPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricing: { ...formData.pricing, perHeadPrice: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Cleaning Fee (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.pricing.extraFees.cleaningFee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricing: {
                        ...formData.pricing,
                        extraFees: {
                          ...formData.pricing.extraFees,
                          cleaningFee: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Service Fee (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.pricing.extraFees.serviceFee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricing: {
                        ...formData.pricing,
                        extraFees: {
                          ...formData.pricing.extraFees,
                          serviceFee: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Facilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {commonFacilities.map((facility) => (
                <div key={facility} className="flex items-center gap-2">
                  <Checkbox
                    id={facility}
                    checked={formData.facilities.includes(facility)}
                    onCheckedChange={() => toggleFacility(facility)}
                  />
                  <label htmlFor={facility} className="text-sm cursor-pointer">
                    {facility}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageUpload(e.target.files)}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Images"}
              </Button>
            </div>

            {formData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img.url}
                      alt={`Property ${idx + 1}`}
                      className="w-full aspect-video object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                    {img.isPrimary && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-semibold">
                        Primary
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!img.isPrimary && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setPrimaryImage(idx)}
                        >
                          Set Primary
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeImage(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => handleVideoUpload(e.target.files)}
                className="hidden"
                id="video-upload-input"
              />
              <Button
                type="button"
                onClick={() => document.getElementById('video-upload-input')?.click()}
                variant="outline"
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Videos"}
              </Button>
            </div>

            {formData.videos.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.videos.map((vid, idx) => (
                  <div key={idx} className="relative group">
                    <video
                      src={vid}
                      controls
                      className="w-full aspect-video rounded-lg bg-black"
                    />
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeVideo(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_available"
                  checked={formData.availability.isAvailable}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      availability: {
                        ...formData.availability,
                        isAvailable: !!checked,
                      },
                    })
                  }
                />
                <label htmlFor="is_available" className="text-sm cursor-pointer">
                  Property is available
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_active"
                  checked={formData.status === "active"}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      status: checked ? "active" : "inactive",
                    })
                  }
                />
                <label htmlFor="is_active" className="text-sm cursor-pointer">
                  Mark as active (visible to customers)
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? "Saving..."
              : isEditing
                ? "Update Property"
                : "Create Property"}
          </Button>
          <Link to="/admin/properties" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
};

export default PropertyForm;
