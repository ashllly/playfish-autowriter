import { NextResponse } from 'next/server';

/**
 * Test endpoint to check Cloudflare R2 configuration
 * This endpoint only shows whether variables are set, not their values
 */
export async function GET() {
  const config = {
    CLOUDFLARE_ACCOUNT_ID: !!process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_ACCESS_KEY_ID: !!process.env.CLOUDFLARE_ACCESS_KEY_ID,
    CLOUDFLARE_SECRET_ACCESS_KEY: !!process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_BUCKET_NAME: !!process.env.CLOUDFLARE_R2_BUCKET_NAME,
    CLOUDFLARE_R2_PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || null, // Show URL for debugging
  };

  const allSet = Object.values(config).every(v => v !== false && v !== null);
  
  return NextResponse.json({
    success: allSet,
    message: allSet 
      ? '✅ All Cloudflare R2 environment variables are configured' 
      : '❌ Some Cloudflare R2 environment variables are missing',
    config: {
      ...config,
      CLOUDFLARE_R2_PUBLIC_URL: config.CLOUDFLARE_R2_PUBLIC_URL ? '✅ Set' : '❌ Missing',
    },
    note: 'For Vercel deployment, add these variables in Vercel Dashboard → Settings → Environment Variables'
  });
}

