// filepath: /Users/stepocampbell/Documents/GitHub/rentfair/src/app/api/cmhc-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { checkForDataUpdates } from '@/lib/data-refresh-scheduler';
import { identifyFieldNames, normalizeBedrooms, mapStructureTypeToCategory } from '@/lib/cmhc';

// Cache for the processed data (24 hours)
let cachedData: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; 

// Flag to prevent multiple simultaneous update checks
let isCheckingForUpdates = false;

/**
 * API endpoint for retrieving CMHC rental market data
 * Fetches data from Statistics Canada, processes it, and returns only the necessary data
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const beds = searchParams.get('beds');
    
    // Check for data updates if we're not already doing so (non-blocking)
    if (!isCheckingForUpdates) {
      isCheckingForUpdates = true;
      
      // Run update check in the background without awaiting it
      checkForDataUpdates()
        .then(wasUpdated => {
          if (wasUpdated) {
            // If data was updated, clear our API cache as well
            cachedData = null;
            cacheTime = 0;
            console.log('🔄 CMHC API: Static data was updated, cache cleared');
          }
        })
        .catch(error => {
          console.error('🔄 CMHC API: Error checking for updates:', error);
        })
        .finally(() => {
          isCheckingForUpdates = false;
        });
    }

    // Return cached data if available and valid
    const now = Date.now();
    if (cachedData && (now - cacheTime < CACHE_DURATION)) {
      // If city and beds are provided, filter the cached data
      if (city && beds) {
        const filteredData = filterData(cachedData, city, beds);
        return NextResponse.json(filteredData, {
          headers: { 
            'Cache-Control': 'max-age=86400',
            'CDN-Cache-Control': 'public, max-age=86400',
            'Vercel-CDN-Cache-Control': 'public, max-age=86400'
          }
        });
      }
      
      return NextResponse.json(cachedData, {
        headers: { 
          'Cache-Control': 'max-age=86400',
          'CDN-Cache-Control': 'public, max-age=86400',
          'Vercel-CDN-Cache-Control': 'public, max-age=86400'
        }
      });
    }

    // CMHC Rental Market Survey data - Table 34-10-0133
    const tableId = "34100133";
    const wdsEndpoint = `https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/${tableId}/en`;
    
    // Step 1: Get the download URL from the WDS API
    const response = await fetch(wdsEndpoint);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch from Statistics Canada API: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const wdsResponse = await response.json();
    
    if (!wdsResponse.status || wdsResponse.status !== "SUCCESS" || !wdsResponse.object) {
      return NextResponse.json(
        { error: 'Invalid response from Statistics Canada WDS API' },
        { status: 500 }
      );
    }
    
    // Step 2: Download the zip file
    const zipDownloadUrl = wdsResponse.object;
    const zipResponse = await fetch(zipDownloadUrl);
    
    if (!zipResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download zip file: ${zipResponse.statusText}` },
        { status: zipResponse.status }
      );
    }
    
    // Step 3: Process the zip file and extract the CSV
    const zipArrayBuffer = await zipResponse.arrayBuffer();
    
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipArrayBuffer);
      
      // Find the CSV file in the zip archive
      const csvFilename = Object.keys(zipContent.files).find(filename => 
        filename.toLowerCase().endsWith('.csv')
      );
      
      if (!csvFilename) {
        return NextResponse.json(
          { error: 'No CSV file found in the archive' },
          { status: 500 }
        );
      }
      
      // Extract the CSV data
      const csvFile = zipContent.files[csvFilename];
      const csvData = await csvFile.async('string');
      
      // Validate CSV data
      if (!csvData || csvData.length < 100) {
        return NextResponse.json(
          { error: 'Invalid CSV data received' },
          { status: 500 }
        );
      }
      
      // Process the data instead of returning raw CSV
      const processedData = processRentalData(csvData);
      
      // Cache the processed data
      cachedData = processedData;
      cacheTime = now;
      
      // If city and beds are provided, filter the data
      if (city && beds) {
        const filteredData = filterData(processedData, city, beds);
        return NextResponse.json(filteredData, {
          headers: { 
            'Cache-Control': 'max-age=86400',
            'CDN-Cache-Control': 'public, max-age=86400',
            'Vercel-CDN-Cache-Control': 'public, max-age=86400'
          }
        });
      }
      
      return NextResponse.json(processedData, {
        headers: { 
          'Cache-Control': 'max-age=86400',
          'CDN-Cache-Control': 'public, max-age=86400',
          'Vercel-CDN-Cache-Control': 'public, max-age=86400'
        }
      });
    } catch (zipError) {
      return NextResponse.json(
        { error: `Error processing zip file: ${zipError instanceof Error ? zipError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to fetch CMHC data: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Process the raw CSV data into a more useful format
 */
function processRentalData(csvData: string) {
  // Parse the CSV data
  const parsedData = Papa.parse<Record<string, string>>(csvData, {
    header: true,
    skipEmptyLines: true
  });
  
  if (!parsedData.data || parsedData.data.length === 0) {
    return { data: [], categories: [], cities: [] };
  }
  
  // Identify field names that match what we need
  const sampleRecord = parsedData.data[0];
  const fieldMap = identifyFieldNames(sampleRecord);
  
  // Process the data
  const processedData = parsedData.data
    // Filter out rows without city/location data or value data
    .filter(record => record[fieldMap.GEO] && record[fieldMap.VALUE])
    // Filter for Ontario cities
    .filter(record => {
      const geo = record[fieldMap.GEO];
      return geo && (
        geo.endsWith(', Ontario') || 
        geo.includes('Ontario') || 
        geo.includes('ON,') ||
        geo.includes(', ON')
      );
    })
    // Map to our expected format
    .map(record => {
      let bedroomInfo = '';
      
      // Extract bedroom info from available fields
      if (fieldMap.Bedrooms && record[fieldMap.Bedrooms]) {
        bedroomInfo = record[fieldMap.Bedrooms];
      } else {
        // Look for any field that might contain bedroom info
        for (const [key, value] of Object.entries(record)) {
          const lowerKey = key.toLowerCase();
          const lowerValue = (value || '').toLowerCase();
          
          if (
            lowerKey.includes('bedroom') || 
            lowerKey.includes('unit') || 
            lowerValue.includes('bedroom') || 
            lowerValue.includes('bachelor')
          ) {
            bedroomInfo = value;
            break;
          }
        }
      }
      
      // Extract reference date information
      let refDate = '';
      if (fieldMap.RefDate && record[fieldMap.RefDate]) {
        refDate = record[fieldMap.RefDate];
      } else {
        // Look for any field that might contain date information
        for (const [key, value] of Object.entries(record)) {
          const lowerKey = key.toLowerCase();
          if (
            lowerKey.includes('date') || 
            lowerKey.includes('period') || 
            lowerKey.includes('year') ||
            lowerKey.includes('ref')
          ) {
            refDate = value;
            break;
          }
        }
      }
      
      // Extract structure type information
      let structureType = '';
      if (fieldMap.StructureType && record[fieldMap.StructureType]) {
        structureType = record[fieldMap.StructureType];
      }
      
      // Calculate data age in months if we have a reference date
      let dataAge = undefined;
      let year = undefined;
      
      if (refDate) {
        // Try to parse the date - handle different formats
        let refDateObj: Date | null = null;
        
        // Try YYYY-MM-DD format
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(refDate)) {
          refDateObj = new Date(refDate);
          year = refDateObj.getFullYear();
        } 
        // Try YYYY format
        else if (/^\d{4}$/.test(refDate)) {
          year = parseInt(refDate);
          refDateObj = new Date(year, 0, 1);
        }
        // Try to extract year from text (like "Reference period: 2023")
        else {
          const yearMatch = refDate.match(/\b(20\d{2})\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[1]);
            refDateObj = new Date(year, 0, 1);
          }
        }
        
        if (refDateObj && !isNaN(refDateObj.getTime())) {
          const currentDate = new Date();
          const monthsDiff = 
            (currentDate.getFullYear() - refDateObj.getFullYear()) * 12 + 
            (currentDate.getMonth() - refDateObj.getMonth());
          dataAge = monthsDiff;
        }
      }
      
      // Map structure type to our housing category
      const category = mapStructureTypeToCategory(structureType);
      
      return {
        city: record[fieldMap.GEO].split(',')[0].trim(),
        fullLocation: record[fieldMap.GEO],
        beds: normalizeBedrooms(bedroomInfo),
        value: parseFloat(record[fieldMap.VALUE].replace(/[^\d.]/g, '')),
        refDate,
        dataAge,
        year,
        structureType,
        category
      };
    })
    // Filter out records without bedroom info or value
    .filter(record => record.beds && !isNaN(record.value));
  
  // Find most recent year in the data
  const years = processedData
    .filter(r => r.year !== undefined)
    .map(r => r.year as number);
  
  const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a); // Sort descending
  let latestYear = uniqueYears.length > 0 ? uniqueYears[0] : 0;
  
  // Filter for only records from the most recent year
  const recentRecords = latestYear > 2008 // Only filter if we found years more recent than 2008
    ? processedData.filter(r => r.year === latestYear)
    : processedData;
    
  // Extract unique cities and categories
  const cities = Array.from(new Set(recentRecords.map(r => r.city))).sort();
  const categories = Array.from(new Set(recentRecords
    .filter(r => r.category)
    .map(r => r.category))).sort();
  
  return {
    data: recentRecords,
    cities,
    categories
  };
}

/**
 * Filter data for specific city and bedroom count
 */
function filterData(data: any, city: string, beds: string) {
  if (!data.data || !Array.isArray(data.data)) {
    return { data: [], categories: [] };
  }
  
  // Filter records for this city and bedroom count
  const filteredRecords = data.data.filter((record: any) => {
    const cityMatches = record.city.toLowerCase() === city.toLowerCase() || 
                      record.fullLocation.toLowerCase().includes(city.toLowerCase());
    const bedsMatch = record.beds === beds;
    return cityMatches && bedsMatch;
  });
  
  // Get available categories for this city/beds combo
  const categories = Array.from(new Set(filteredRecords
    .filter((r: any) => r.category)
    .map((r: any) => r.category)
  ));
  
  return {
    data: filteredRecords,
    categories
  };
}