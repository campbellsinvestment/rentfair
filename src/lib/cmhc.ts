import Papa from 'papaparse';
import JSZip from 'jszip';

interface RentalRecord {
  GEO: string;
  Bedrooms: string;
  VALUE: string;
  [key: string]: string;
}

let cachedData: RentalRecord[] | null = null;

/**
 * Normalizes bedroom strings to numeric values
 * @param bedroom - The bedroom string from the dataset
 * @returns - Normalized bedroom value as a string
 */
const normalizeBedrooms = (bedroom: string): string => {
  // Handle various potential formats in the data
  if (!bedroom) return '';
  
  const lowerBedroom = bedroom.toLowerCase();
  
  if (lowerBedroom.includes('bachelor') || lowerBedroom.includes('studio')) {
    return '0';
  } else if (lowerBedroom.includes('one') || lowerBedroom.includes('1 bedroom')) {
    return '1';
  } else if (lowerBedroom.includes('two') || lowerBedroom.includes('2 bedroom')) {
    return '2';
  } else if (
    lowerBedroom.includes('three') || 
    lowerBedroom.includes('3 bedroom') || 
    lowerBedroom.includes('3+') ||
    lowerBedroom.includes('three or more')
  ) {
    return '3+';
  }
  
  // Try to extract numeric values
  const numMatch = bedroom.match(/(\d+)/);
  if (numMatch) {
    return numMatch[1];
  }
  
  // Return original if no matches
  return bedroom;
};

/**
 * Tries to identify column names in data that match our expected fields
 * @param record - A sample data record
 * @returns - Mapping of standard field names to actual field names in the data
 */
const identifyFieldNames = (record: Record<string, string>): Record<string, string> => {
  const fieldMap: Record<string, string> = {
    GEO: '',
    Bedrooms: '',
    VALUE: ''
  };
  
  // Find location/geography field
  for (const key of Object.keys(record)) {
    const lowerKey = key.toLowerCase();
    
    if (fieldMap.GEO === '' && (
      lowerKey.includes('geo') || 
      lowerKey.includes('location') || 
      lowerKey.includes('city') ||
      lowerKey.includes('geography')
    )) {
      fieldMap.GEO = key;
    }
    
    if (fieldMap.Bedrooms === '' && (
      lowerKey.includes('bedroom') || 
      lowerKey.includes('room') || 
      lowerKey.includes('type of unit') ||
      lowerKey.includes('unit type') ||
      lowerKey.includes('apartment type') ||
      lowerKey.includes('dwelling type')
    )) {
      fieldMap.Bedrooms = key;
    }
    
    if (fieldMap.VALUE === '' && (
      lowerKey.includes('value') || 
      lowerKey.includes('price') || 
      lowerKey.includes('rent') ||
      lowerKey.includes('amount') ||
      lowerKey.includes('cost')
    )) {
      fieldMap.VALUE = key;
    }
  }
  
  console.log('Field mapping detected:', fieldMap);
  return fieldMap;
};

/**
 * Fetches and processes rental data from Statistics Canada using the Web Data Service API
 * @returns - Promise resolving to processed rental records
 */
export const fetchRentalData = async (): Promise<RentalRecord[]> => {
  if (cachedData) return cachedData;
  
  // CMHC Rental Market Survey data - Table 34-10-0133
  // This table contains average rents by bedroom type and geography
  const tableId = "34100133"; // Correct table ID for CMHC rental data
  const wdsEndpoint = `https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/${tableId}/en`;
  
  try {
    console.log('Fetching data from Statistics Canada WDS API...');
    
    // First, request the download URL from the WDS API
    const response = await fetch(wdsEndpoint);
    if (!response.ok) {
      // Get the response text for better error reporting
      const errorText = await response.text();
      throw new Error(`Failed to fetch data from Statistics Canada WDS API: ${response.statusText} - ${errorText}`);
    }
    
    const wdsResponse = await response.json();
    
    if (!wdsResponse.status || wdsResponse.status !== "SUCCESS" || !wdsResponse.object) {
      throw new Error(`Invalid response from Statistics Canada WDS API: ${JSON.stringify(wdsResponse)}`);
    }
    
    // Get the zip file download URL from the response
    const zipDownloadUrl = wdsResponse.object;
    console.log(`Downloading zip file from: ${zipDownloadUrl}`);
    
    // Download the zip file
    const zipResponse = await fetch(zipDownloadUrl);
    if (!zipResponse.ok) {
      throw new Error(`Failed to download zip file: ${zipResponse.statusText}`);
    }
    
    // Get the zip file as an ArrayBuffer
    const zipArrayBuffer = await zipResponse.arrayBuffer();
    console.log('Zip file downloaded, extracting content...');
    
    // Use JSZip to extract the zip file
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipArrayBuffer);
    
    // Find the CSV file in the zip archive (usually the first file with .csv extension)
    const csvFilename = Object.keys(zipContent.files).find(filename => 
      filename.toLowerCase().endsWith('.csv')
    );
    
    if (!csvFilename) {
      throw new Error('No CSV file found in the zip archive');
    }
    
    console.log(`Found CSV file in archive: ${csvFilename}`);
    
    // Extract the CSV file content
    const csvFile = zipContent.files[csvFilename];
    const csvData = await csvFile.async('string');
    
    console.log('CSV file extracted, parsing data...');
    
    // Parse the CSV data
    const parsedData = Papa.parse<Record<string, string>>(csvData, {
      header: true,
      skipEmptyLines: true
    });
    
    if (!parsedData.data || parsedData.data.length === 0) {
      throw new Error('No data found in the CSV response');
    }
    
    console.log(`Parsed ${parsedData.data.length} rows from CSV`);
    
    // Get a sample record to determine field names
    const sampleRecord = parsedData.data[0];
    console.log('Sample record:', JSON.stringify(sampleRecord));
    
    // Identify field names that match what we need
    const fieldMap = identifyFieldNames(sampleRecord);
    
    // If we couldn't find the bedroom field, try alternative approaches
    if (!fieldMap.Bedrooms) {
      // Look for a field that might contain unit type information
      const potentialBedroomFields = ['Type of unit', 'Dwelling type', 'Unit type'];
      
      for (const field of potentialBedroomFields) {
        if (sampleRecord[field]) {
          fieldMap.Bedrooms = field;
          console.log(`Using '${field}' field for bedroom information`);
          break;
        }
      }
    }
    
    console.log('Final field mapping:', fieldMap);
    
    // Convert data to our expected format
    const processedData = parsedData.data
      // First filter out rows without city/location data or value data
      .filter(record => record[fieldMap.GEO] && record[fieldMap.VALUE])
      // Then filter for Ontario cities
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
        
        // Try to extract bedroom info from available fields
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
        
        return {
          GEO: record[fieldMap.GEO],
          Bedrooms: normalizeBedrooms(bedroomInfo),
          VALUE: record[fieldMap.VALUE],
          // Include all original fields too
          ...record
        };
      })
      // Filter out records without bedroom info or value
      .filter(record => record.Bedrooms && record.VALUE);
    
    console.log(`Found ${processedData.length} Ontario rental records`);
    
    if (processedData.length > 0) {
      console.log('Sample processed record:', JSON.stringify(processedData[0]));
      
      // Log unique bedroom types found
      const bedroomTypes = Array.from(new Set(processedData.map(r => r.Bedrooms))).sort();
      console.log('Bedroom types found:', bedroomTypes);
      
      // Log unique locations
      const locations = Array.from(new Set(processedData.map(r => r.GEO))).slice(0, 10);
      console.log('Sample locations (first 10):', locations);
    }
    
    if (processedData.length === 0) {
      throw new Error('No Ontario rental data found in the dataset');
    }
    
    cachedData = processedData;
    return processedData;
  } catch (error) {
    console.error('Error fetching rental data:', error);
    // Return empty array instead of throwing to prevent cascading failures
    return [];
  }
};

/**
 * Gets the average rent for a specific city and bedroom count
 * @param city - The city name
 * @param beds - The bedroom count
 * @returns - Average price or null if no data found
 */
export const getAverage = async (city: string, beds: string): Promise<number | null> => {
  try {
    const data = await fetchRentalData();
    
    if (data.length === 0) {
      console.error('No rental data available');
      return null;
    }
    
    // Find matching records for the city and bedroom count
    const records = data.filter(item => {
      const matchesCity = item.GEO.toLowerCase().includes(city.toLowerCase());
      const matchesBeds = item.Bedrooms === beds;
      return matchesCity && matchesBeds;
    });
    
    if (records.length === 0) {
      console.log(`No matching records found for ${city}, ${beds} bedrooms`);
      return null;
    }
    
    // Log the matched records for debugging
    console.log(`Found ${records.length} matching records for ${city}, ${beds} bedrooms:`);
    records.forEach((r, i) => console.log(`Record ${i+1}: ${r.GEO}, ${r.Bedrooms}, ${r.VALUE}`));
    
    // If we have multiple records, take the average
    if (records.length > 1) {
      const validValues = records
        .map(r => r.VALUE)
        .map(val => parseFloat(val.replace(/[$,]/g, '')))
        .filter(num => !isNaN(num));
      
      if (validValues.length === 0) return null;
      
      const sum = validValues.reduce((a, b) => a + b, 0);
      return sum / validValues.length;
    }
    
    // Parse the numeric value from the string (remove $ and ,)
    const value = parseFloat(records[0].VALUE.replace(/[$,]/g, ''));
    return isNaN(value) ? null : value;
  } catch (error) {
    console.error('Error getting average rent:', error);
    return null;
  }
};