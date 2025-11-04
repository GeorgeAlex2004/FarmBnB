# FarmBnB - Frontend Development Prompt for Lovable

## Project Overview
Build a modern, responsive AirBnB-like property booking platform called "FarmBnB" with two distinct user modes: Admin Dashboard and Customer Booking Interface.

## Design Requirements
- **Design Style**: Modern, clean, Airbnb-inspired UI with a rustic/farm aesthetic
- **Color Scheme**: Earth tones (greens, browns) with white/cream backgrounds
- **Responsive**: Mobile-first design, fully responsive for desktop, tablet, and mobile
- **Framework**: React with TypeScript (or JavaScript if TypeScript not available)
- **UI Library**: Tailwind CSS for styling
- **Icons**: Use React Icons or similar icon library
- **Image Handling**: Support for multiple image uploads with preview/carousel

## Application Structure

### 1. Authentication Pages
- **Login Page** (`/login`)
  - Email/password login form
  - Role selection toggle or separate admin/customer login options
  - "Forgot Password" link
  - Error handling display
  - Smooth animations on submit

- **Register Page** (`/register`) - Optional
  - Customer registration form
  - Email verification flow
  - Terms & conditions checkbox

### 2. Admin Dashboard (`/admin/*`)
- **Admin Layout**
  - Sidebar navigation with:
    - Dashboard Overview
    - Properties Management
    - Bookings Management
    - Settings/Profile
    - Logout button
  - Header with admin name and notifications
  - Mobile hamburger menu

- **Admin Dashboard Home** (`/admin/dashboard`)
  - Statistics cards:
    - Total Properties
    - Total Bookings
    - Revenue (if applicable)
    - Pending Bookings
  - Recent bookings table/list
  - Quick actions (Add Property, View Bookings)

- **Properties Management** (`/admin/properties`)
  - List view of all properties in a grid/card layout
  - Each card shows: thumbnail, name, location, status (active/inactive)
  - "Add New Property" button (floating or prominent)
  - Search/filter functionality
  - Edit/Delete actions on each property card

- **Add/Edit Property Form** (`/admin/properties/new`, `/admin/properties/edit/:id`)
  - Multi-step form or single page with sections:
    - **Basic Information**:
      - Property name
      - Location (address, city, state, zip)
      - Description (rich text editor)
      - Maximum number of guests
    - **Photos Section**:
      - Drag-and-drop image upload area
      - Preview gallery of uploaded images
      - Ability to reorder images
      - Remove images option
      - Support for 10+ images
    - **Pricing**:
      - Base price per night
      - Per-head expense/charge
      - Extra fees (cleaning fee, service fee, etc.)
      - Discount fields (weekly/monthly)
    - **Facilities**:
      - Checkbox grid of facilities:
        - WiFi, Parking, Pool, Kitchen, Air Conditioning, Heating
        - Pet-friendly, Smoking allowed, etc.
      - Custom facility input
    - **Availability Calendar** (optional advanced feature):
      - Calendar view to mark unavailable dates
    - Save/Cancel buttons with loading states

- **Bookings Management** (`/admin/bookings`)
  - Table/list view with columns:
    - Booking ID
    - Customer Name
    - Property Name
    - Check-in Date
    - Check-out Date
    - Number of Guests
    - Total Amount
    - Advance Paid
    - Status (Pending, Confirmed, Cancelled, Completed)
  - Filter by status, date range, property
  - View booking details modal/page
  - Export bookings (optional)

### 3. Customer Interface (`/` or `/customer/*`)
- **Home/Landing Page** (`/`)
  - Hero section with search bar:
    - Location search
    - Check-in/Check-out date pickers
    - Number of guests selector
    - "Search" button
  - Featured properties carousel/grid
  - Categories/sections
  - How it works section

- **Properties Listing Page** (`/properties` or `/search`)
  - Search filters sidebar:
    - Price range slider
    - Number of guests
    - Facilities checkboxes
    - Date availability
  - Property cards grid:
    - Property image carousel (swipeable)
    - Property name and location
    - Rating/reviews (if applicable)
    - Price per night
    - Key facilities icons
    - "View Details" button
  - Pagination or infinite scroll
  - Map view toggle (optional)

- **Property Details Page** (`/properties/:id`)
  - Large image gallery (swipeable, full-screen on click)
  - Property title and location
  - Share and favorite buttons
  - Price breakdown:
    - Base price per night
    - Per-head charges
    - Extra fees
    - Total estimate
  - Property description
  - Facilities list with icons
  - Maximum guests info
  - Booking calendar:
    - Date picker showing available dates
    - Highlights unavailable dates
    - Number of guests selector
    - Dynamic price calculation based on dates and guests
  - Booking form/section:
    - Check-in/Check-out dates
    - Number of guests (with per-head pricing display)
    - Price breakdown:
      - Base (nights × price)
      - Guests (per-head × guests)
      - Extra fees
      - Total
      - Advance payment (e.g., 30% or fixed amount)
    - "Book Now" button
    - Terms & conditions checkbox
  - Reviews section (optional)

- **Booking Confirmation** (`/booking/:id` or `/booking/confirm`)
  - Booking summary
  - Payment form (Stripe/PayPal placeholder or actual integration)
  - Payment method selection
  - Billing information
  - Confirmation after successful payment

- **User Bookings** (`/my-bookings` or `/customer/bookings`)
  - List of user's bookings
  - Status indicators
  - Ability to view details
  - Cancel booking option (with policy display)

- **User Profile** (`/profile`)
  - Personal information
  - Change password
  - Booking history

### 4. Components Library
Create reusable components:
- `Button` - Primary, secondary, outline variants
- `Input` - Text, email, password, date, number inputs
- `Card` - Property card, booking card
- `Modal` - For confirmations, details view
- `ImageCarousel` - For property photos
- `Calendar` - Date picker with availability
- `LoadingSpinner` - Loading states
- `Toast/Notification` - Success/error messages
- `Header/Navbar` - Responsive navigation
- `Footer` - Site footer

### 5. State Management
- Use React Context API or Redux/Zustand for:
  - Authentication state
  - User role (admin/customer)
  - Selected booking dates
  - Cart/bookings in progress

### 6. API Integration
- API base URL should be configurable
- Use fetch or axios for API calls
- Implement error handling with user-friendly messages
- Loading states for all async operations
- Token-based authentication (store in localStorage/sessionStorage)

### 7. Routes
```
/ - Home/Properties listing
/login - Login page
/register - Registration (optional)
/properties - Properties listing with filters
/properties/:id - Property details
/booking/:id - Booking page
/my-bookings - Customer bookings
/profile - User profile
/admin/dashboard - Admin dashboard
/admin/properties - Properties management
/admin/properties/new - Add property
/admin/properties/edit/:id - Edit property
/admin/bookings - Bookings management
```

### 8. Additional Features
- **Responsive Images**: Use srcset for different screen sizes
- **Lazy Loading**: Lazy load images and components
- **SEO**: Meta tags, structured data
- **Accessibility**: ARIA labels, keyboard navigation
- **Form Validation**: Client-side validation with error messages
- **Date Formatting**: Use date-fns or moment.js
- **Toast Notifications**: Success/error feedback
- **Protected Routes**: Route guards for admin/customer pages
- **Image Optimization**: Compress/optimize images before upload

### 9. Mobile Considerations
- Bottom navigation bar for mobile
- Swipe gestures for image carousels
- Touch-friendly buttons (min 44x44px)
- Simplified filters on mobile (drawer/modal)

### 10. Performance
- Code splitting for routes
- Image lazy loading
- Optimize bundle size
- Fast page transitions

## Technical Stack Recommendations
- **React** with **TypeScript** (preferred) or JavaScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **React Query** or **SWR** for data fetching
- **React Hook Form** for form management
- **Date-fns** for date handling
- **React Icons** for icons
- **Axios** or **Fetch** for API calls

## API Endpoints to Integrate
(Assume these will be provided by backend)
- `POST /api/auth/login` - Login
- `GET /api/properties` - List properties
- `GET /api/properties/:id` - Property details
- `POST /api/properties` - Create property (admin)
- `PUT /api/properties/:id` - Update property (admin)
- `DELETE /api/properties/:id` - Delete property (admin)
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Booking details
- `POST /api/payments` - Process payment

## Design Inspiration
- Airbnb's clean, modern interface
- Booking.com's detailed property pages
- VRBO's rustic property aesthetic
- Focus on beautiful property photography

---

**Note**: This is a comprehensive prompt. You can start with MVP features and iterate. Prioritize the admin property management and customer booking flow first.

