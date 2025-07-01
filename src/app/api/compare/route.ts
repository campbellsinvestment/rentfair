import { getAverage } from '@/lib/cmhc';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🔴 API-COMPARE: Route called');
  
  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city');
  const beds = searchParams.get('beds');
  const priceStr = searchParams.get('price');
  const category = searchParams.get('category') || '';
  
  console.log(`🔴 API-COMPARE: Parameters - city: ${city}, beds: ${beds}, price: ${priceStr}, category: ${category}`);

  // Validate parameters
  if (!city || !beds || !priceStr) {
    console.log('🔴 API-COMPARE: Missing required parameters');
    return NextResponse.json(
      { error: 'Missing required parameters: city, beds, price' },
      { status: 400 }
    );
  }

  // Validate price
  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) {
    console.log('🔴 API-COMPARE: Invalid price value');
    return NextResponse.json(
      { error: 'Price must be a positive number' },
      { status: 400 }
    );
  }

  try {
    console.log(`🔴 API-COMPARE: Calling getAverage for ${city}, ${beds}${category ? ', ' + category : ''}`);
    
    // Get average rent for the specified city, bedroom count, and category (if provided)
    const averageResult = await getAverage(city, beds, category || undefined);
    console.log('🔴 API-COMPARE: getAverage returned:', JSON.stringify(averageResult));
    
    if (averageResult.value === null) {
      console.log('🔴 API-COMPARE: No data available for this city/beds combination');
      return NextResponse.json(
        { error: 'No data available for the specified city and bedroom count' },
        { status: 404 }
      );
    }

    const average = averageResult.value;
    
    // Calculate delta and percentage difference
    const delta = price - average;
    const percent = delta / average;
    
    // Calculate adjusted average based on data age (if available)
    // Assuming approximately 5% annual rent increase
    let adjustedAverage = average;
    const dataAgeMention = averageResult.dataAge
      ? `${averageResult.dataAge} months old`
      : 'unknown age';
    let adjustmentApplied = false;
    
    if (averageResult.dataAge && averageResult.dataAge > 6) {
      // Apply an adjustment for data older than 6 months
      // Using 5% annual increase as a baseline, calculated monthly
      const monthlyIncreaseRate = 0.05 / 12;
      const adjustment = 1 + monthlyIncreaseRate * averageResult.dataAge;
      adjustedAverage = average * adjustment;
      adjustmentApplied = true;
    }

    const result = {
      average,
      delta,
      percent,
      dataAge: averageResult.dataAge,
      dataAgeMention,
      adjustedAverage: adjustmentApplied ? adjustedAverage : undefined,
      adjustmentApplied,
      category: category || undefined, // Include the selected category in the response
    };
    
    console.log('🔴 API-COMPARE: Returning result:', JSON.stringify(result));
    
    // Return comparison data with caching header
    return NextResponse.json(
      result,
      {
        headers: {
          'Cache-Control': 's-maxage=86400',
        },
      }
    );
  } catch (error) {
    console.error('🔴 API-COMPARE: Error in compare route:', error);
    return NextResponse.json(
      { error: 'Failed to process comparison request' },
      { status: 500 }
    );
  }
}