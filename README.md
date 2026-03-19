# 格價助手 Price Tracker v2

A modern web app for recording and comparing purchase prices in Hong Kong. Track your purchases, compare prices across stores, and browse today's market prices — all in one place.

## Features

- 🔐 **Google Authentication** — Secure login with your Google account
- 📝 **Purchase Records** — Record item name, price, category, and location
- 📸 **Camera Capture** — Scan receipts or price tags using your phone camera
- 📊 **Market Prices** — Browse today's estimated HK market prices
- 🔍 **Search & Filter** — Find items by name, category, or location
- 📱 **Responsive Design** — Works on desktop, tablet, and mobile

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **Backend:** Firebase (Authentication + Firestore)
- **Icons:** Lucide React
- **Deployment:** Firebase Hosting

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Authentication and Firestore enabled

### Setup

1. Clone the repository:

```bash
git clone https://github.com/Kk-KelvinLam/kk-helper-app-v2.git
cd kk-helper-app-v2
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file from the example:

```bash
cp .env.example .env
```

4. Update `.env` with your Firebase project configuration:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

5. Start the development server:

```bash
npm run dev
```

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Google Authentication** in Authentication → Sign-in method
3. Create a **Firestore Database** in Cloud Firestore
4. Deploy Firestore security rules:

```bash
npx firebase deploy --only firestore:rules
```

### Deployment

Build and deploy to Firebase Hosting:

```bash
npm run build
npx firebase deploy
```

## CI/CD with GitHub Actions

This project uses GitHub Actions to automatically deploy to Firebase Hosting:

- **`firebase-deploy.yml`** — Deploys to the live channel on every push to `main`
- **`firebase-preview.yml`** — Deploys a preview channel for every pull request to `main`

### Required GitHub Secrets

Go to your repository **Settings → Secrets and variables → Actions** and add the following secrets:

| Secret | Description |
|--------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (e.g. `your-project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (see below) |

### How to get `FIREBASE_SERVICE_ACCOUNT`

The `FIREBASE_SERVICE_ACCOUNT` secret is a **Google Cloud service account key in JSON format** that allows GitHub Actions to authenticate with Firebase on your behalf.

**Steps to generate it:**

1. Go to the [Firebase Console](https://console.firebase.google.com) and open your project
2. Click the ⚙️ **Project settings** gear icon (top-left)
3. Go to the **Service accounts** tab
4. Click **Generate new private key** → **Generate key**
5. A `.json` file will be downloaded — open it in a text editor and **copy the entire contents**
6. In your GitHub repository, go to **Settings → Secrets and variables → Actions**
7. Click **New repository secret**, name it `FIREBASE_SERVICE_ACCOUNT`, and paste the JSON as the value
8. Click **Add secret**

> ⚠️ Keep the service account JSON private. Never commit it to the repository.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run preview` | Preview production build |

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── AddRecordModal.tsx
│   ├── CameraCapture.tsx
│   ├── EditRecordModal.tsx
│   ├── Layout.tsx
│   └── PurchaseCard.tsx
├── contexts/          # React contexts
│   └── AuthContext.tsx
├── lib/               # Utility libraries
│   ├── firebase.ts
│   ├── marketPrices.ts
│   └── purchases.ts
├── pages/             # Page components
│   ├── LoginPage.tsx
│   ├── MarketPricePage.tsx
│   └── RecordsPage.tsx
├── types/             # TypeScript type definitions
│   └── index.ts
├── App.tsx            # Root app component
├── main.tsx           # Entry point
└── index.css          # Global styles
```
