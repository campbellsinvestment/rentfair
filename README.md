# RentFair

Compare your Ontario apartment rent to current market rates and see if you're getting a fair deal.

## Live Demo

[Coming soon!](#)

## Project Overview

RentFair is a Next.js application that allows users to compare their rental prices against average market rates in Ontario. The application fetches data from Statistics Canada to provide accurate comparisons.

## Stack Diagram

```
                   ┌─────────────────┐
                   │   Next.js App   │
                   └────────┬────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
┌─────────▼──────┐ ┌────────▼────────┐ ┌─────▼────────┐
│  React UI/UX   │ │ Next.js API     │ │ CMHC Data    │
│  - TailwindCSS │ │ - Edge Runtime  │ │ - PapaParse  │
│  - React Toast │ │ - Caching       │ │              │
└────────────────┘ └─────────────────┘ └──────────────┘
```

## Features

- Compare rental prices against market averages in Ontario cities
- Color-coded results (red, yellow, green) based on comparison
- Share results via clipboard
- URL-based sharing of comparisons
- Mobile-friendly responsive design

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

RentFair is configured for deployment with Vercel. Here are the deployment options:

### Option 1: Deploy with Vercel (Recommended)

1. Fork this repository to your GitHub account
2. Create a new project in [Vercel](https://vercel.com)
3. Import your forked GitHub repository
4. Vercel will automatically detect Next.js and configure the build settings
5. Deploy and your app will be live at `https://your-project-name.vercel.app`

### Option 2: GitHub Actions Automated Deployment

For automated deployments using GitHub Actions:

1. In your GitHub repository, go to Settings > Secrets and variables > Actions
2. Add the following secrets:
   - `VERCEL_TOKEN`: Your Vercel API token
   - `VERCEL_ORG_ID`: Your Vercel organization ID
   - `VERCEL_PROJECT_ID`: Your Vercel project ID
3. Push to the main branch to trigger automatic deployment

### Option 3: Self-Hosting

RentFair can also be self-hosted on any platform supporting Node.js:

1. Build the application:
   ```
   npm run build
   ```
2. Start the production server:
   ```
   npm run start
   ```
3. Configure your web server (Nginx, Apache) to proxy requests to the Node.js server

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Styling**: TailwindCSS
- **Data Parsing**: PapaParse
- **Notifications**: React Hot Toast
- **Testing**: Vitest

## License

ISC