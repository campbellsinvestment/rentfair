// Using ES module imports instead of CommonJS require
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import Papa from 'papaparse';
// Import from cmhc module using ES module syntax
import { identifyFieldNames, normalizeBedrooms, mapStructureTypeToCategory, RentalRecord } from './cmhc';

/**
 * This script fetches CMHC data once and saves it as a static JSON file
 * Run this script periodically (e.g., monthly) to update the data
 */

export const fetchStaticData = async () => {
  console.log('Fetching CMHC data for static file...');
  
  try {
    // Step 1: Access the Statistics Canada API
    const tableId = "34100133";
    const wdsEndpoint = `https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/${tableId}/en`;
    
    console.log(`Calling Statistics Canada WDS API: ${wdsEndpoint}`);
    // Create an AbortController with timeout for better compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(wdsEndpoint, { 
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Statistics Canada API error: ${response.status} - ${response.statusText}`);
    }
    
    const wdsResponse = await response.json();
    
    if (!wdsResponse.status || wdsResponse.status !== "SUCCESS" || !wdsResponse.object) {
      throw new Error('Invalid response from Statistics Canada WDS API');
    }
    
    // Step 2: Download the ZIP file
    const zipDownloadUrl = wdsResponse.object;
    console.log(`Downloading ZIP from ${zipDownloadUrl}`);
    
    // Create another AbortController for ZIP download
    const zipController = new AbortController();
    const zipTimeoutId = setTimeout(() => zipController.abort(), 60000); // 60 second timeout
    
    const zipResponse = await fetch(zipDownloadUrl, { 
      signal: zipController.signal
    });
    
    // Clear the timeout
    clearTimeout(zipTimeoutId);
    
    if (!zipResponse.ok) {
      throw new Error(`Failed to download ZIP: ${zipResponse.status} - ${zipResponse.statusText}`);
    }
    
    // Step 3: Process the ZIP file and extract the CSV
    const zipArrayBuffer = await zipResponse.arrayBuffer();
    console.log(`ZIP downloaded (${(zipArrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipArrayBuffer);
    
    // Find the CSV file in the ZIP
    const csvFilename = Object.keys(zipContent.files).find(filename => 
      filename.toLowerCase().endsWith('.csv')
    );
    
    if (!csvFilename) {
      throw new Error('No CSV file found in the ZIP archive');
    }
    
    // Extract the CSV
    const csvFile = zipContent.files[csvFilename];
    const csvData = await csvFile.async('string');
    console.log(`CSV extracted (${(csvData.length / 1024 / 1024).toFixed(2)} MB)`);
    
    // Parse the CSV
    const parsedData = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });
    
    if (!parsedData.data || parsedData.data.length === 0) {
      throw new Error('No data found in the CSV');
    }
    
    console.log(`CSV parsed with ${parsedData.data.length} records`);
    
    // Process the data (similar to fetchRentalData in cmhc.ts)
    const sampleRecord = parsedData.data[0] as Record<string, string>;
    const fieldMap = identifyFieldNames(sampleRecord);
    
    console.log('Field mapping:', fieldMap);
    
    // Process and filter the data
    const processedData = parsedData.data
      // Filter out rows without city/location data or value data
      .filter((record: any) => record[fieldMap.GEO] && record[fieldMap.VALUE])
      // Filter for Ontario cities
      .filter((record: any) => {
        const geo = record[fieldMap.GEO];
        return geo && (
          geo.endsWith(', Ontario') || 
          geo.includes('Ontario') || 
          geo.includes('ON,') ||
          geo.includes(', ON')
        );
      })
      // Map to our expected format
      .map((record: any) => {
        let bedroomInfo = '';
        
        // Extract bedroom info from available fields
        if (fieldMap.Bedrooms && record[fieldMap.Bedrooms]) {
          bedroomInfo = record[fieldMap.Bedrooms];
        } else {
          // Look for any field that might contain bedroom info
          for (const [key, value] of Object.entries(record)) {
            const lowerKey = key.toLowerCase();
            const lowerValue = (value as string || '').toLowerCase();
            
            if (
              lowerKey.includes('bedroom') || 
              lowerKey.includes('unit') || 
              lowerValue.includes('bedroom') || 
              lowerValue.includes('bachelor')
            ) {
              bedroomInfo = value as string;
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
            const lowerValue = (value as string || '').toLowerCase();
            
            if (
              lowerKey.includes('date') || 
              lowerKey.includes('period') || 
              lowerKey.includes('year') ||
              lowerKey.includes('ref') ||
              lowerValue.includes('20') // Looking for year like "2023" or "2024"
            ) {
              refDate = value as string;
              break;
            }
          }
        }
        
        // Extract structure type information
        let structureType = '';
        if (fieldMap.StructureType && record[fieldMap.StructureType]) {
          structureType = record[fieldMap.StructureType];
        } else {
          // Look for any field that might contain structure type information
          for (const [key, value] of Object.entries(record)) {
            const lowerKey = key.toLowerCase();
            const lowerValue = (value as string || '').toLowerCase();
            
            if (
              lowerKey.includes('structure') || 
              lowerKey.includes('building') || 
              lowerKey.includes('type') && !lowerKey.includes('unit')
            ) {
              structureType = value as string;
              break;
            }
          }
        }
        
        // Calculate data age in months if we have a reference date
        let dataAge = undefined;
        let yearFromRefDate = undefined;
        
        if (refDate) {
          // Try to parse the date - handle different formats
          let refDateObj = null;
          
          // Try YYYY-MM-DD format
          if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(refDate)) {
            refDateObj = new Date(refDate);
            yearFromRefDate = refDateObj.getFullYear();
          } 
          // Try YYYY format
          else if (/^\d{4}$/.test(refDate)) {
            yearFromRefDate = parseInt(refDate);
            refDateObj = new Date(yearFromRefDate, 0, 1);
          }
          // Try to extract year from text (like "Reference period: 2023")
          else {
            const yearMatch = refDate.match(/\b(20\d{2})\b/);
            if (yearMatch) {
              yearFromRefDate = parseInt(yearMatch[1]);
              refDateObj = new Date(yearFromRefDate, 0, 1);
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
          GEO: record[fieldMap.GEO],
          Bedrooms: normalizeBedrooms(bedroomInfo),
          VALUE: record[fieldMap.VALUE],
          RefDate: refDate,
          DataAge: dataAge,
          Year: yearFromRefDate,
          StructureType: structureType,
          Category: category
        } as RentalRecord;
      })
      // Filter out records without bedroom info or value
      .filter((record: RentalRecord) => record.Bedrooms && record.VALUE);
    
    console.log(`Processed ${processedData.length} valid records`);
    
    // Find years in the data
    const years = processedData
      .filter(r => r.Year !== undefined)
      .map(r => r.Year as number);
    
    const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a); // Sort descending
    
    console.log(`Found data for years: ${uniqueYears.join(', ')}`);
    
    // Get only records from the most recent year
    let latestYear = 0;
    if (uniqueYears.length > 0) {
      latestYear = uniqueYears[0]; // First item is the most recent year
    }
    
    // Filter for only records from the most recent year
    const recentRecords = latestYear > 2008 // Only filter if we found years more recent than 2008
      ? processedData.filter(r => r.Year === latestYear)
      : processedData;
    
    // If we don't have enough recent records, fall back to the full dataset
    const finalData = recentRecords.length < 10 && processedData.length >= 10
      ? processedData
      : recentRecords;
    
    console.log(`Final dataset contains ${finalData.length} records from year ${latestYear || 'unknown'}`);
    
    // Create metadata
    const metadata = {
      generatedAt: new Date().toISOString(),
      recordCount: finalData.length,
      dataYear: latestYear || undefined,
      uniqueBedroomTypes: Array.from(new Set(finalData.map(r => r.Bedrooms))),
      uniqueCities: Array.from(new Set(finalData.map(r => r.GEO.split(',')[0].trim()))).length,
      uniqueStructureTypes: Array.from(new Set(finalData.map(r => r.StructureType || 'Unknown'))),
      uniqueCategories: Array.from(new Set(finalData.map(r => r.Category || 'Uncategorized')))
    };
    
    // Create the output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the data file
    const outputPath = path.join(outputDir, 'cmhc-data.json');
    fs.writeFileSync(outputPath, JSON.stringify({ metadata, data: finalData }, null, 2));
    
    console.log(`Static data file generated at ${outputPath}`);
    console.log(`File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log('Metadata:', metadata);
    
    return { success: true, recordCount: finalData.length };
  } catch (error) {
    console.error('Error generating static data file:', error);
    return { success: false, error };
  }
};

// Run the function if this script is executed directly
// Check for both ESM and CommonJS execution contexts
const isMainModule = typeof require !== 'undefined' ? 
  require.main === module : 
  import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  fetchStaticData().then(result => {
    console.log('Script finished with result:', result);
    process.exit(result.success ? 0 : 1);
  }).catch(err => {
    console.error('Script failed with error:', err);
    process.exit(1);
  });
}

// Export the function
export default fetchStaticData;