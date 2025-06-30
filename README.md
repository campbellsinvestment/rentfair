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
   pnpm install
   ```
3. Run the development server:
   ```
   pnpm dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Styling**: TailwindCSS
- **Data Parsing**: PapaParse
- **Notifications**: React Hot Toast
- **Testing**: Vitest

## License

ISC