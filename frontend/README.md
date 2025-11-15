# FarmBnB Frontend

This is the frontend application for FarmBnB, an AirBnB-like property booking platform.

**Note**: This is a frontend-only application using Supabase for backend services. No separate backend server is required.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Supabase project (sign up at https://supabase.com)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Configure your environment variables:
```env
# Required - Get these from Supabase project settings
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here

# Optional - For UPI payments
VITE_UPI_ID=your-upi-id@paytm
VITE_UPI_QR_CODE_URL=https://your-qr-code-url.com/qr.png
```

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:8080`

### Build

Build for production:
```bash
npm run build
```

The built files will be in the `dist` directory.

## 📦 Deployment

### Vercel Deployment

This project is configured for easy deployment to Vercel. See [VERCEL_DEPLOYMENT.md](../VERCEL_DEPLOYMENT.md) for detailed instructions.

Quick steps:
1. Push your code to GitHub/GitLab/Bitbucket
2. Import the repository in Vercel
3. Set root directory to `frontend`
4. Add environment variables in Vercel dashboard
5. Deploy!

### Other Platforms

This is a standard Vite + React application and can be deployed to:
- **Netlify**: Use the Vite build preset
- **Cloudflare Pages**: Use the Vite build preset
- **AWS Amplify**: Configure build settings for Vite
- **Any static hosting**: Build with `npm run build` and serve the `dist` folder

## 📁 Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── ui/           # shadcn/ui components
│   ├── Navbar.tsx    # Navigation bar
│   └── PropertyCard.tsx
├── contexts/         # React contexts
│   └── AuthContext.tsx
├── hooks/           # Custom React hooks
├── lib/             # Utilities
│   ├── api.ts       # API client
│   └── utils.ts
├── pages/           # Page components
│   ├── admin/       # Admin pages
│   ├── Landing.tsx
│   ├── Login.tsx
│   ├── Properties.tsx
│   └── PropertyDetails.tsx
└── integrations/    # Third-party integrations
```

## 🔧 Features

- ✅ User authentication (Login/Register)
- ✅ Property browsing with filters
- ✅ Property details and booking
- ✅ Admin dashboard
- ✅ Property management (CRUD)
- ✅ Booking management
- ✅ Responsive design
- ✅ Modern UI with animations

## 🔌 Supabase Integration

The frontend uses Supabase directly for all backend operations:
- **Authentication**: Supabase Auth (email/password)
- **Database**: PostgreSQL via Supabase
- **Storage**: Supabase Storage for images
- **Security**: Row Level Security (RLS) policies

All API calls are made directly to Supabase using the `@supabase/supabase-js` client library. No separate backend server is required.

## 🎨 Styling

- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for component library
- Custom CSS animations and transitions
- Responsive design with mobile-first approach

## 📝 Environment Variables

### Required:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

### Optional:
- `VITE_UPI_ID` - Your UPI ID for payments (e.g., `your-phone@paytm`)
- `VITE_UPI_QR_CODE_URL` - URL to your UPI QR code image
- `VITE_BASE_PATH` - Base path if deploying to a subdirectory (default: `/`)

## 🛠️ Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- Sonner (Toasts)

## 📄 License

ISC
