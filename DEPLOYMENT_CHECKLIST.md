# Vercel Deployment Checklist

## Pre-Deployment Steps

### 1. Supabase Setup ✅
- [ ] Create Supabase project at https://supabase.com
- [ ] Run `FRESH_SUPABASE_SETUP.sql` in Supabase SQL Editor
- [ ] Run `FIX_BOOKING_AVAILABILITY_RLS.sql` for booking availability fix
- [ ] Run `set_admin_user.sql` to create admin user (replace UUID with your user ID)
- [ ] Create storage bucket named `images` and set it to public
- [ ] Get API credentials from Settings > API:
  - Project URL → `VITE_SUPABASE_URL`
  - anon/public key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### 2. Code Preparation ✅
- [ ] Remove Firebase dependency (already done)
- [ ] Ensure all backend files are removed (already done)
- [ ] Test build locally: `cd frontend && npm run build`
- [ ] Verify build output in `frontend/dist` directory

### 3. Git Repository ✅
- [ ] Push code to GitHub/GitLab/Bitbucket
- [ ] Ensure `.env` is in `.gitignore` (never commit secrets)
- [ ] Commit all changes

## Vercel Deployment Steps

### 4. Vercel Project Setup
- [ ] Go to https://vercel.com/new
- [ ] Import your Git repository
- [ ] Configure project settings:
  - **Framework Preset**: Vite (or leave as auto-detect)
  - **Root Directory**: `frontend`
  - **Build Command**: `npm run build` (auto-detected)
  - **Output Directory**: `dist` (auto-detected)
  - **Install Command**: `npm install` (auto-detected)

### 5. Environment Variables
Add these in Vercel dashboard (Settings > Environment Variables):

**Required:**
- `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = `your-anon-key-here`

**Optional:**
- `VITE_UPI_ID` = `your-upi-id@paytm`
- `VITE_UPI_QR_CODE_URL` = `https://your-qr-code-url.com/qr.png`

**Important:** After adding environment variables, trigger a new deployment!

### 6. Supabase URL Configuration
- [ ] Go to Supabase Dashboard > Authentication > URL Configuration
- [ ] Set **Site URL**: `https://your-app.vercel.app`
- [ ] Add **Redirect URLs**: `https://your-app.vercel.app/**`

### 7. Deploy
- [ ] Click **Deploy** in Vercel
- [ ] Wait for build to complete
- [ ] Check build logs for any errors
- [ ] Visit your deployed URL

## Post-Deployment Verification

### 8. Testing
- [ ] Test user registration
- [ ] Test user login
- [ ] Test property browsing
- [ ] Test booking creation (as customer)
- [ ] Test admin login
- [ ] Test admin features (properties, bookings, calendar, analytics)
- [ ] Test image uploads
- [ ] Test payment flow

### 9. Production Optimizations
- [ ] Enable Vercel Analytics (optional)
- [ ] Set up custom domain (optional)
- [ ] Configure environment-specific variables (production vs preview)
- [ ] Set up monitoring/error tracking (optional)

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Ensure `package.json` has correct build script
- Check for TypeScript errors locally first

### Authentication Issues
- Verify Supabase URL configuration includes Vercel domain
- Check environment variables are correct
- Clear browser cache and localStorage
- Check Supabase Auth logs

### Images Not Loading
- Verify Supabase Storage bucket is public
- Check RLS policies on storage bucket
- Verify image URLs in database

### Environment Variables Not Working
- Variables must start with `VITE_` prefix
- Redeploy after adding variables
- Check variable names are exact (case-sensitive)
- Verify variables are set for correct environment (Production/Preview/Development)

## Quick Deploy Command

If using Vercel CLI:
```bash
cd frontend
vercel --prod
```

## Support

For issues, check:
- Vercel deployment logs
- Supabase logs (Dashboard > Logs)
- Browser console for client-side errors
- Network tab for API errors

