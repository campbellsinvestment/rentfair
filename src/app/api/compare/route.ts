import { getAverage } from '@/lib/cmhc';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city');
  const beds = searchParams.get('beds');
  const priceStr = searchParams.get('price');

  // Validate parameters
  if (!city || !beds || !priceStr) {
    return NextResponse.json(
      { error: 'Missing required parameters: city, beds, price' },
      { status: 400 }
    );
  }

  // Validate price
  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) {
    return NextResponse.json(
      { error: 'Price must be a positive number' },
      { status: 400 }
    );
  }

  // Get average rent for the specified city and bedroom count
  const average = await getAverage(city, beds);
  if (average === null) {
    return NextResponse.json(
      { error: 'No data available for the specified city and bedroom count' },
      { status: 404 }
    );
  }

  // Calculate delta and percentage difference
  const delta = price - average;
  const percent = delta / average;

  // Return comparison data with caching header
  return NextResponse.json(
    { average, delta, percent },
    {
      headers: {
        'Cache-Control': 's-maxage=86400',
      },
    }
  );
}