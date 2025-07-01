// filepath: /Users/stepocampbell/Documents/GitHub/rentfair/src/app/api/test-cities/route.ts
import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import JSZip from 'jszip';

// Server-side function to fetch and parse CMHC data
// We need to reimplement this here because the client-side fetch in fetchRentalData() won't work in an API route
async function getServerSideCMHCData() {
  try {
    console.log('Server: Fetching CMHC data for city analysis');
    
    // CMHC Rental Market Survey data - Table 34-10-0133
    const tableId = "34100133";
    const wdsEndpoint = `https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/${tableId}/en`;
    
    // Step 1: Get the download URL from the WDS API
    console.log('Server: Requesting download URL from Statistics Canada');
    const response = await fetch(wdsEndpoint);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from Statistics Canada API: ${response.statusText}`);
    }
    
    const wdsResponse = await response.json();
    
    if (!wdsResponse.status || wdsResponse.status !== "SUCCESS" || !wdsResponse.object) {
      throw new Error('Invalid response from Statistics Canada WDS API');
    }
    
    // Step 2: Get the zip file download URL
    const zipDownloadUrl = wdsResponse.object;
    console.log(`Server: Downloading zip file from ${zipDownloadUrl.substring(0, 60)}...`);
    
    // Step 3: Download the zip file
    const zipResponse = await fetch(zipDownloadUrl);
    if (!zipResponse.ok) {
      throw new Error(`Failed to download zip file: ${zipResponse.statusText}`);
    }
    
    // Step 4: Process the zip file and extract the CSV
    const zipArrayBuffer = await zipResponse.arrayBuffer();
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipArrayBuffer);
    
    // Find the CSV file in the zip archive
    const csvFilename = Object.keys(zipContent.files).find(filename => 
      filename.toLowerCase().endsWith('.csv')
    );
    
    if (!csvFilename) {
      throw new Error('No CSV file found in the archive');
    }
    
    console.log(`Server: Found CSV file in archive: ${csvFilename}`);
    
    // Extract and parse the CSV data
    const csvFile = zipContent.files[csvFilename];
    const csvData = await csvFile.async('string');
    
    // Parse the CSV data
    const parsedData = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });
    
    if (!parsedData.data || parsedData.data.length === 0) {
      throw new Error('No data found in the CSV');
    }
    
    return parsedData.data;
  } catch (error) {
    console.error('Error fetching CMHC data:', error);
    throw error;
  }
}

export async function GET() {
  try {
    console.log('API: Running city analysis...');
    
    // Get the data directly from Statistics Canada (server-side)
    const rawData = await getServerSideCMHCData();
    
    console.log(`API: Got ${rawData.length} records from Statistics Canada`);
    
    // Find field names by examining the first record
    const sampleRecord = rawData[0];
    
    let geoField = '';
    let bedroomField = '';
    let valueField = '';
    let refDateField = '';
    
    // Find location/geography field
    for (const key of Object.keys(sampleRecord)) {
      const lowerKey = key.toLowerCase();
      
      if (geoField === '' && (
        lowerKey.includes('geo') || 
        lowerKey.includes('location') || 
        lowerKey.includes('city') ||
        lowerKey.includes('geography')
      )) {
        geoField = key;
      }
      
      if (bedroomField === '' && (
        lowerKey.includes('bedroom') || 
        lowerKey.includes('room') || 
        lowerKey.includes('type of unit') ||
        lowerKey.includes('unit type') ||
        lowerKey.includes('apartment type') ||
        lowerKey.includes('dwelling type')
      )) {
        bedroomField = key;
      }
      
      if (valueField === '' && (
        lowerKey.includes('value') || 
        lowerKey.includes('price') || 
        lowerKey.includes('rent') ||
        lowerKey.includes('amount') ||
        lowerKey.includes('cost')
      )) {
        valueField = key;
      }
      
      if (refDateField === '' && (
        lowerKey.includes('ref') || 
        lowerKey.includes('date') || 
        lowerKey.includes('period') ||
        lowerKey.includes('year') ||
        lowerKey.includes('time')
      )) {
        refDateField = key;
      }
    }
    
    console.log('API: Found field mappings:', { geoField, bedroomField, valueField, refDateField });
    
    if (!geoField) {
      console.error('API: Could not find GEO field in data');
      return NextResponse.json({ error: 'Could not find location field in data' }, { status: 500 });
    }
    
    // Filter for Ontario records
    const ontarioRecords = rawData.filter(record => {
      const geo = record[geoField];
      return geo && (
        geo.endsWith(', Ontario') || 
        geo.includes('Ontario') || 
        geo.includes('ON,') ||
        geo.includes(', ON')
      );
    });
    
    console.log(`API: Found ${ontarioRecords.length} Ontario records`);
    
    // Extract city names and clean them up
    const cities = ontarioRecords.map(record => {
      // Extract the city name from the GEO field
      let city = record[geoField];
      
      // Remove province/state information
      city = city.replace(/, Ontario$/, '')
                .replace(/, ON$/, '')
                .replace(/ \(Ontario\)$/, '')
                .replace(/ Ontario$/, '');
      
      // Remove CMA/CA/ER designations
      city = city.replace(/ CMA$/, '')
                .replace(/ CA$/, '')
                .replace(/ \(CMA\)$/, '')
                .replace(/ \(CA\)$/, '')
                .replace(/ Census Metropolitan Area$/, '')
                .replace(/ Census Agglomeration$/, '')
                .replace(/ Economic Region$/, '');
      
      return city.trim();
    });
    
    // Get unique city names and sort alphabetically
    const uniqueCities = Array.from(new Set(cities)).sort();
    
    // Also provide raw cities without cleaning for comparison
    const rawCities = Array.from(new Set(ontarioRecords.map(record => record[geoField]))).sort();
    
    // Get stats on bedroom types if bedroom field was found
    const bedroomTypes = bedroomField 
      ? Array.from(new Set(ontarioRecords.map(record => record[bedroomField]))).sort()
      : [];
    
    // Get sample data
    const sampleData = ontarioRecords.slice(0, 5).map(record => ({
      geo: record[geoField],
      bedroom: bedroomField ? record[bedroomField] : 'N/A',
      value: valueField ? record[valueField] : 'N/A'
    }));
    
    return NextResponse.json({
      recordCount: ontarioRecords.length,
      fields: { geoField, bedroomField, valueField, refDateField },
      processedCities: {
        count: uniqueCities.length,
        list: uniqueCities
      },
      rawCities: {
        count: rawCities.length,
        list: rawCities
      },
      bedroomTypes,
      sampleData
    });
  } catch (error: any) {
    console.error('API: Error analyzing cities:', error);
    return NextResponse.json(
      { error: `Failed to analyze cities: ${error.message}` },
      { status: 500 }
    );
  }
}