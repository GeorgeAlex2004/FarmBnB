import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateWhatsAppLink, generateCaretakerMessage, copyToClipboard } from "@/lib/whatsapp";
import { MessageSquare, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const TestWhatsAppMessage = () => {
  const [caretakerPhone, setCaretakerPhone] = useState("+919980022113");
  
  // Sample booking data for testing
  const sampleBooking = {
    bookingId: "abc123-def456-ghi789",
    propertyName: "Serene Farm Stay",
    checkInDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
    checkOutDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days from now
    numGuests: 4,
    customerName: "John Doe",
    foodPreference: "both",
    allergies: "Peanuts, Gluten",
    specialRequests: "Outside food not allowed. Food required: Both: 2 Veg, 2 Non-Veg; allergies: Peanuts, Gluten",
    vegGuests: 2,
    nonVegGuests: 2,
  };

  const message = generateCaretakerMessage(sampleBooking);
  const whatsappLink = caretakerPhone ? generateWhatsAppLink(caretakerPhone, message) : null;

  const handleCopy = async () => {
    const success = await copyToClipboard(message);
    if (success) {
      toast.success("Message copied to clipboard!");
    } else {
      toast.error("Failed to copy message");
    }
  };

  const handleOpenWhatsApp = () => {
    if (whatsappLink) {
      window.open(whatsappLink, '_blank');
    } else {
      toast.error("Please enter a valid caretaker phone number");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">WhatsApp Message Test</h1>
        <p className="text-muted-foreground">
          Preview and test the caretaker notification message format
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Sample Booking Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Property</Label>
              <p className="font-medium">{sampleBooking.propertyName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Booking ID</Label>
              <p className="font-mono text-xs">{sampleBooking.bookingId}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Check-in</Label>
              <p>{new Date(sampleBooking.checkInDate).toLocaleDateString('en-IN', { 
                day: 'numeric', month: 'long', year: 'numeric' 
              })}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Check-out</Label>
              <p>{new Date(sampleBooking.checkOutDate).toLocaleDateString('en-IN', { 
                day: 'numeric', month: 'long', year: 'numeric' 
              })}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Guests</Label>
              <p>{sampleBooking.numGuests} {sampleBooking.numGuests === 1 ? 'guest' : 'guests'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Customer</Label>
              <p>{sampleBooking.customerName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Food Preference</Label>
              <p>{sampleBooking.foodPreference === 'both' ? 'Both (Mixed)' : sampleBooking.foodPreference}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Allergies</Label>
              <p>{sampleBooking.allergies || 'None'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Generated WhatsApp Message
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg border-2 border-dashed">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {message}
              </pre>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopy} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy Message
              </Button>
              {whatsappLink && (
                <Button onClick={handleOpenWhatsApp} className="bg-green-600 hover:bg-green-700">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Open WhatsApp
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">Caretaker Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={caretakerPhone}
                onChange={(e) => setCaretakerPhone(e.target.value)}
                placeholder="+919876543210"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include country code (e.g., +91 for India)
              </p>
            </div>
            {whatsappLink && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">WhatsApp Link:</p>
                <p className="text-xs font-mono break-all">{whatsappLink}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">How it works:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Enter the caretaker's phone number (with country code)</li>
            <li>Click "Copy Message" to copy the formatted message</li>
            <li>Click "Open WhatsApp" to open WhatsApp with the message pre-filled</li>
            <li>The message will be ready to send to the caretaker</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestWhatsAppMessage;

