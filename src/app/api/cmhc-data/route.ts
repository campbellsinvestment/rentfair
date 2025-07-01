// filepath: /Users/stepocampbell/Documents/GitHub/rentfair/src/app/api/cmhc-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// Cache for the processed data (24 hours)
let cachedData: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; 

/**
 * API endpoint for retrieving CMHC rental market data
 * Fetches data from Statistics Canada, processes it, and caches the results
 */
export async function GET(request: NextRequest) {
  try {
    // Return cached data if available and valid
    const now = Date.now();
    if (cachedData && (now - cacheTime < CACHE_DURATION)) {
      return NextResponse.json(cachedData, {
        headers: { 'Cache-Control': 'max-age=86400' }
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
      
      // Cache the data
      cachedData = { data: csvData };
      cacheTime = now;
      
      return NextResponse.json(
        { data: csvData },
        {
          headers: { 'Cache-Control': 'max-age=86400' }
        }
      );
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