# GitHub Deployment Guide

This project is now prepared for deployment to GitHub. All sensitive information (like your `.env` file and local database) has been excluded from the repository.

## 1. Create a GitHub Repository
1. Go to [github.com/new](https://github.com/new).
2. Name your repository (e.g., `career-course-compass`).
3. Keep it **Public** or **Private** as you prefer.
4. **Do NOT** initialize with a README, `.gitignore`, or License (you already have these).

## 2. Push Your Code
Open your terminal in the project folder and run:

```bash
# Add the remote URL (Replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Rename branch to main (if not already)
git branch -M main

# Push to GitHub
git push -u origin main
```

## 3. Hosting the Application
Since this is a Node.js application, you cannot host it directly on "GitHub Pages" (which only supports static sites). I recommend using **Render** (which you already have a `render.yaml` for) or **Railway**.

### Deploying on Render:
1. Sign in to [Render](https://render.com/).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub account and select your repository.
4. Render will read your `render.yaml` and start the deployment.
5. **CRITICAL**: Go to the **Environment** tab in your Render dashboard and add your variables from `.env`:
   - `SESSION_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` (Update this to your Render URL)
   - `NODE_ENV` (Set to `production`)

## 4. Safety Checklist
- [x] `.env` file is ignored (Verified in `.gitignore`)
- [x] `database.db` is ignored (Verified in `.gitignore`)
- [x] `node_modules` is ignored (Verified in `.gitignore`)
- [x] No hardcoded secrets found in `server.js`
