# Vercel Deployment Guide for FarmBnB

This guide will help you deploy FarmBnB to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. A Supabase project (create one at https://supabase.com)
3. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Supabase Project

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the `FRESH_SUPABASE_SETUP.sql` file to set up your database
4. Run the `FIX_BOOKING_AVAILABILITY_RLS.sql` file to fix booking availability
5. Run the `set_admin_user.sql` file (replace the UUID with your user ID) to set up an admin user
6. Go to **Settings > API** and copy:
   - Project URL (for `VITE_SUPABASE_URL`)
   - anon/public key (for `VITE_SUPABASE_PUBLISHABLE_KEY`)

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your Git repository
3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (should auto-detect)
   - **Output Directory**: `dist` (should auto-detect)
4. Add Environment Variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon key
   - `VITE_UPI_ID` (optional) - Your UPI ID for payments
   - `VITE_UPI_QR_CODE_URL` (optional) - URL to your UPI QR code image
5. Click **Deploy**

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. Add environment variables:
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
   vercel env add VITE_UPI_ID
   vercel env add VITE_UPI_QR_CODE_URL
   ```

6. Redeploy with environment variables:
   ```bash
   vercel --prod
   ```

## Step 3: Configure Environment Variables in Vercel

After deployment, you can add/update environment variables:

1. Go to your project on Vercel dashboard
2. Navigate to **Settings > Environment Variables**
3. Add the following variables:

### Required Variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

### Optional Variables:
- `VITE_UPI_ID` - Your UPI ID (e.g., `your-phone@paytm`)
- `VITE_UPI_QR_CODE_URL` - URL to your UPI QR code image

**Important**: After adding environment variables, you need to redeploy for them to take effect.

## Step 4: Configure Supabase for Production

1. Go to your Supabase project dashboard
2. Navigate to **Authentication > URL Configuration**
3. Add your Vercel deployment URL to:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: `https://your-app.vercel.app/**`

## Step 5: Verify Deployment

1. Visit your deployed URL
2. Test user registration and login
3. Test property browsing
4. Test booking creation (as a customer)
5. Test admin features (as an admin)

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Verify the build command is `npm run build`
- Check the build logs in Vercel dashboard

### Authentication Not Working
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct
- Check Supabase URL configuration includes your Vercel domain
- Clear browser cache and localStorage

### Images Not Loading
- Ensure images are uploaded to Supabase Storage
- Check Supabase Storage bucket policies allow public read access
- Verify image URLs in the database are correct

### Environment Variables Not Working
- Environment variables must start with `VITE_` to be accessible in the frontend
- After adding variables, trigger a new deployment
- Check variable names match exactly (case-sensitive)

## Continuous Deployment

Vercel automatically deploys on every push to your main branch. To disable auto-deployment or configure branch deployments:

1. Go to **Settings > Git**
2. Configure branch deployments as needed

## Custom Domain

To add a custom domain:

1. Go to **Settings > Domains**
2. Add your domain
3. Follow the DNS configuration instructions
4. Update Supabase redirect URLs to include your custom domain

