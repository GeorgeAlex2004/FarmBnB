# FarmBnB

This repository is configured for Vercel deployment of the frontend app located in `frontend/`.

## Deploying to Vercel

### Configuration Steps:
1. **Import Repository** in Vercel Dashboard
2. **Set Root Directory** to `frontend`
3. **Framework Preset**: Vite (auto-detected)
4. **Build Command**: Auto-detected (`npm run build`)
5. **Output Directory**: Auto-detected (`dist`)

### Environment Variables (set in Vercel Project Settings):
- `VITE_API_BASE_URL` → Your API base URL (e.g., `https://api.example.com`)
- `VITE_UPI_ID` → UPI ID to display on the Payment page
- `VITE_UPI_QR_CODE_URL` → Public URL to the QR code image

**Important**: Set the **Root Directory** to `frontend` in Vercel project settings. The `frontend/vercel.json` file handles SPA routing.

## Local Development

```bash
cd frontend
npm i
npm run dev
```

## Notes
- Backend (`routes/`, `server.js`) is not deployed on Vercel. Use an external host for the Node API and point `VITE_API_BASE_URL` to it.
- Static frontend is built and served by Vercel using `@vercel/static-build` as configured in `vercel.json`.

# FarmBnB - Property Booking Platform

An AirBnB-like application for managing and booking farm properties. This platform provides two distinct interfaces: an admin dashboard for property management and a customer-facing booking interface.

## Features

### Admin Features
- ✅ User authentication and authorization
- ✅ Property management (CRUD operations)
- ✅ Multiple image uploads for properties
- ✅ Configure pricing (base price, per-head charges, extra fees)
- ✅ Set facilities and amenities
- ✅ Manage bookings
- ✅ View booking details and status
- ✅ Confirm/cancel bookings
- ✅ Dashboard with statistics

### Customer Features
- ✅ User registration and login
- ✅ Browse properties with filters
- ✅ View property details with image gallery
- ✅ Check property availability
- ✅ Make bookings with date selection
- ✅ See price breakdown (per night, per head, fees)
- ✅ Advance payment processing (Stripe integration)
- ✅ View booking history
- ✅ Cancel bookings

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **JWT** for authentication
- **Stripe** for payment processing
- **Multer** for file uploads
- **bcryptjs** for password hashing

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Stripe account (for payments)

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FarmBnB
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - MongoDB connection string
   - JWT secret
   - Stripe API keys
   - Admin credentials

4. **Create uploads directory**
   ```bash
   mkdir uploads
   touch uploads/.gitkeep
   ```

5. **Create admin user**
   ```bash
   node scripts/createAdmin.js
   ```

6. **Start the server**
   ```bash
   npm run dev
   ```

   The server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new customer
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Properties
- `GET /api/properties` - List properties (with filters)
- `GET /api/properties/:id` - Get property details
- `POST /api/properties` - Create property (Admin)
- `PUT /api/properties/:id` - Update property (Admin)
- `DELETE /api/properties/:id` - Delete property (Admin)
- `GET /api/properties/:id/availability` - Check availability

### Bookings
- `GET /api/bookings` - List bookings
- `GET /api/bookings/:id` - Get booking details
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id/confirm` - Confirm booking (Admin)
- `PUT /api/bookings/:id/cancel` - Cancel booking
- `PUT /api/bookings/:id/complete` - Mark as completed (Admin)

### Payments
- `POST /api/payments/create-intent` - Create Stripe payment intent
- `POST /api/payments/confirm` - Confirm payment
- `POST /api/payments/webhook` - Stripe webhook handler
- `GET /api/payments/booking/:id` - Get payment details

### Uploads
- `POST /api/upload/image` - Upload single image (Admin)
- `POST /api/upload/images` - Upload multiple images (Admin)
- `DELETE /api/upload/image/:filename` - Delete image (Admin)

## Environment Variables

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/farmbnb
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
ADMIN_EMAIL=admin@farmbnb.com
ADMIN_PASSWORD=admin123
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
WEBHOOK_SECRET=whsec_...
MAX_FILE_SIZE=5242880
```

## Database Models

### User
- name, email, password, role (admin/customer)
- phone, address
- isActive, createdAt, updatedAt

### Property
- name, description, location
- images array
- pricing (basePrice, perHeadPrice, extraFees, discounts)
- capacity (maxGuests, bedrooms, beds, bathrooms)
- facilities and amenities
- availability and status

### Booking
- bookingNumber, property, customer
- checkIn, checkOut, numberOfGuests
- pricing breakdown
- payment status and details
- booking status

## Frontend

See `LOVABLE_FRONTEND_PROMPT.md` for the complete frontend development prompt that can be used with Lovable or any React-based frontend framework.

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Role-based access control (Admin/Customer)
- Input validation with express-validator
- File upload size and type restrictions
- Rate limiting ready (express-rate-limit included)

## Payment Integration

The application uses Stripe for payment processing:
- Advance payment (30% of total amount)
- Payment intents for secure transactions
- Webhook handling for payment confirmations
- Support for full payment processing

## Development

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Project Structure

```
FarmBnB/
├── models/           # Mongoose models
│   ├── User.js
│   ├── Property.js
│   └── Booking.js
├── routes/           # API routes
│   ├── auth.js
│   ├── properties.js
│   ├── bookings.js
│   ├── payments.js
│   └── upload.js
├── middleware/       # Custom middleware
│   └── auth.js
├── utils/            # Utility functions
│   └── calculatePrice.js
├── scripts/          # Helper scripts
│   └── createAdmin.js
├── uploads/          # Uploaded images
├── server.js         # Main server file
├── package.json
└── README.md
```

## Future Enhancements

- [ ] Email notifications
- [ ] Reviews and ratings system
- [ ] Calendar view for availability
- [ ] Advanced search with geolocation
- [ ] Multi-language support
- [ ] Booking reminders
- [ ] Refund processing
- [ ] Analytics dashboard
- [ ] Export bookings to CSV/PDF
- [ ] SMS notifications

## License

ISC

## Support

For issues and questions, please create an issue in the repository.

