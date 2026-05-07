# Google OAuth Setup Guide

## Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "NEW PROJECT"
3. Name it "Course Compass" and click Create
4. Wait for the project to be created

## Step 2: Enable Google Identity Services API
1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Identity Services"
3. Click on it and press **ENABLE**

## Step 3: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. You'll be asked to create a consent screen first:
   - Click **CONFIGURE CONSENT SCREEN**
   - Choose **External** user type
   - Fill in:
     - App name: "Course Code Compass"
     - User support email: (your email)
     - Developer contact: (your email)
   - Click **SAVE AND CONTINUE** through all screens
   - Click **BACK TO CREDENTIALS**

4. Now create OAuth 2.0 Client ID:
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Application type: **Web application**
   - Name: "Course Compass Web"
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
   - Click **CREATE**

## Step 4: Get Your Credentials
1. Your OAuth 2.0 Client will be created
2. Copy the **Client ID** (this is the long string starting with numbers and ending with .googleusercontent.com)

## Step 5: Update login.html
In the file `login.html`, find this line (around line 34):
```html
data-client_id="YOUR_GOOGLE_CLIENT_ID_HERE"
```

Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with your actual Client ID from Step 4.

Example:
```html
data-client_id="123456789-abcdefghijklmnop.apps.googleusercontent.com"
```

## Step 6: Test It Out
1. Make sure your server is running: `node server.js`
2. Open http://localhost:3000
3. You should see a Google Sign-In button
4. Click it and sign in with your Google account
5. You should be redirected to the recommendation page

## Troubleshooting

**Button doesn't appear?**
- Check your Client ID is correctly pasted
- Make sure JavaScript console has no errors (F12 → Console)
- Verify port 3000 is running

**Sign-in fails with CORS error?**
- Make sure `http://localhost:3000` is in "Authorized JavaScript origins"
- Make sure `http://localhost:3000/auth/google/callback` is in "Authorized redirect URIs"

**"Origin mismatch" error?**
- Your origin must be exactly `http://localhost:3000`
- For production, add your domain to authorized origins

## For Production Deployment
- Generate a new OAuth credential for your production domain
- Add production domain to authorized origins/redirect URIs
- Update Client ID in HTML for production
- Store sensitive information in environment variables
