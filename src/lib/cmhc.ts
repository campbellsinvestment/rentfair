import Papa from 'papaparse';
import JSZip from 'jszip';
// Import fs and path only in server context
const fs = typeof window === 'undefined' ? require('fs') : null;
const path = typeof window === 'undefined' ? require('path') : null;

export interface RentalRecord {
  GEO: string;
  Bedrooms: string;
  VALUE: string;
  RefDate?: string;  
  DataAge?: number;  
  Year?: number;     
  StructureType?: string;
  Category?: string;
  [key: string]: string | number | undefined;
}

let cachedData: RentalRecord[] | null = null;
let lastCacheCheck: number = 0;

// Check if cache invalidation has been signaled
const checkCacheInvalidation = () => {
  try {
    // Only check once per minute to avoid file system overhead
    const now = Date.now();
    if (now - lastCacheCheck < 60000) return;
    lastCacheCheck = now;

    // Server-side only check (filesystem access)
    if (typeof window === 'undefined' && fs && path) {
      const cacheSignalFile = path.join(process.cwd(), 'public', 'data', '.cache-invalidated');
      if (fs.existsSync(cacheSignalFile)) {
        const signalTimestamp = parseInt(fs.readFileSync(cacheSignalFile, 'utf-8'));
        
        // If the signal file is newer than our last check, invalidate cache
        if (!isNaN(signalTimestamp) && signalTimestamp > lastCacheCheck - 60000) {
          console.log('📢 Cache invalidation detected, clearing cached data');
          cachedData = null;
        }
      }
    }
  } catch (error) {
    // Silent catch - don't let this disrupt normal operation
  }
}

// List of Ontario cities based on CMHC data
export const ONTARIO_CITIES = [
  'Barrie',
  'Belleville',
  'Bracebridge',
  'Brantford',
  'Brighton',
  'Brock',
  'Brockville',
  'Centre Wellington',
  'Chatham-Kent',
  'Cobourg',
  'Collingwood',
  'Cornwall',
  'Dunnville',
  'Elliot Lake',
  'Erin',
  'Essex',
  'Fergus',
  'Fort Erie',
  'Gravenhurst',
  'Greater Napanee',
  'Greater Sudbury',
  'Guelph',
  'Haldimand County',
  'Halton Hills',
  'Hamilton',
  'Huntsville',
  'Ingersoll',
  'Kapuskasing',
  'Kawartha Lakes',
  'Kenora',
  'Kincardine',
  'Kings Subdivision',
  'Kingston',
  'Kirkland Lake',
  'Kitchener-Cambridge-Waterloo',
  'Lambton Shores',
  'Leamington',
  'Lincoln',
  'London',
  'Meaford',
  'Midland',
  'Milton',
  'Mississippi Mills',
  'Nanticoke',
  'Newcastle',
  'Norfolk',
  'North Bay',
  'North Grenville',
  'North Perth',
  'Orangeville',
  'Orillia',
  'Oshawa',
  'Ottawa-Gatineau',
  'Owen Sound',
  'Pembroke',
  'Petawawa',
  'Peterborough',
  'Port Hope',
  'Prince Edward',
  'Sarnia',
  'Saugeen Shores',
  'Sault Ste. Marie',
  'Scugog',
  'Smiths Falls',
  'South Huron',
  'St. Andrews',
  'St. Catharines-Niagara',
  'St. Thomas',
  'Stratford',
  'Strathroy',
  'Temiskaming Shores',
  'The Nation',
  'Thunder Bay',
  'Tillsonburg',
  'Timmins',
  'Toronto',
  'Trent Hills',
  'Trenton',
  'Wallaceburg',
  'Wasaga Beach',
  'West Grey',
  'West Nipissing',
  'Windsor',
  'Woodstock'
];

/**
 * Normalizes bedroom strings to numeric values
 */
export const normalizeBedrooms = (bedroom: string): string => {
  if (!bedroom) return '';
  
  const lowerBedroom = bedroom.toLowerCase();
  
  // Exact matches for the known CMHC dataset format
  if (lowerBedroom === 'bachelor units') {
    return '0';
  } else if (lowerBedroom === 'one bedroom units') {
    return '1';
  } else if (lowerBedroom === 'two bedroom units') {
    return '2';
  } else if (lowerBedroom === 'three bedroom units') {
    return '3+';
  }
  
  // Fallback to more generic patterns
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
  
  // Extract numeric values
  const numMatch = bedroom.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    if (num >= 3) return '3+';
    return numMatch[1];
  }
  
  return bedroom;
};

/**
 * Identifies column names in data that match our expected fields
 */
export const identifyFieldNames = (record: Record<string, string>): Record<string, string> => {
  const fieldMap: Record<string, string> = {
    GEO: '',
    Bedrooms: '',
    VALUE: '',
    RefDate: '',
    StructureType: ''
  };
  
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
    
    if (fieldMap.RefDate === '' && (
      lowerKey.includes('ref') || 
      lowerKey.includes('date') || 
      lowerKey.includes('period') ||
      lowerKey.includes('year') ||
      lowerKey.includes('time')
    )) {
      fieldMap.RefDate = key;
    }
    
    if (fieldMap.StructureType === '' && (
      lowerKey.includes('type of structure') ||
      lowerKey.includes('structure') ||
      lowerKey.includes('building type') ||
      lowerKey.includes('dwelling structure')
    )) {
      fieldMap.StructureType = key;
    }
  }
  
  // If StructureType wasn't found and there's a field literally named "Type of structure"
  if (fieldMap.StructureType === '' && record["Type of structure"]) {
    fieldMap.StructureType = "Type of structure";
  }
  
  return fieldMap;
};

/**
 * Fetches and processes rental data from static JSON file or Statistics Canada as fallback
 */
export const fetchRentalData = async (): Promise<RentalRecord[]> => {
  // Check for cache invalidation
  checkCacheInvalidation();
  
  // Return cached data if available
  if (cachedData) return cachedData;
  
  try {
    // First try to load from the static file
    const isServer = typeof window === 'undefined';
    
    console.log('🔍 Fetching CMHC data from static file');
    try {
      // Create proper absolute URLs for server environment
      // In the browser, relative URLs work fine; on the server, we need to use fs or provide a base URL
      let staticDataUrl;
      
      if (isServer) {
        // On the server, either use fs directly or create an absolute URL
        try {
          // Try to use filesystem directly first (more reliable)
          if (fs && path) {
            const filePath = path.join(process.cwd(), 'public', 'data', 'cmhc-data.json');
            if (fs.existsSync(filePath)) {
              const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              if (fileData.data && Array.isArray(fileData.data)) {
                console.log(`🔍 Loaded ${fileData.data.length} records from filesystem`);
                cachedData = fileData.data;
                return fileData.data;
              }
            }
          }
        } catch (fsError) {
          console.log('🔍 Failed to load file from filesystem, trying URL fetch');
        }
        
        // Fallback to URL fetch with absolute URL (needs a valid base URL in server environment)
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_BASE_URL || 'https://rentfairontario.vercel.app';
          
        staticDataUrl = new URL('/data/cmhc-data.json', baseUrl).toString();
      } else {
        // In browser, relative URL works fine
        staticDataUrl = '/data/cmhc-data.json';
      }
      
      console.log(`🔍 Fetching data from: ${staticDataUrl}`);
      
      // Attempt to load from static file first (much faster and more reliable)
      const staticResponse = await fetch(staticDataUrl, { 
        // Use only one caching strategy to fix the conflict
        next: { revalidate: 86400 } // Revalidate once per day
      });
      
      if (staticResponse.ok) {
        const staticData = await staticResponse.json();
        if (staticData.data && Array.isArray(staticData.data) && staticData.data.length > 0) {
          console.log(`🔍 Loaded ${staticData.data.length} records from static file`);
          cachedData = staticData.data;
          return staticData.data;
        }
      }
    } catch (staticError) {
      console.warn('🔍 Failed to load static data file:', staticError);
      // Continue to API fallback
    }
    
    // Fallback to API if static file loading fails
    console.log('🔍 Falling back to API data fetch');
    
    // Create proper absolute URL for API in server environment
    let apiUrl;
    
    if (isServer) {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_BASE_URL || 'https://rentfairontario.vercel.app';
        
      apiUrl = new URL('/api/cmhc-data', baseUrl).toString();
    } else {
      // In browser, relative URL works fine
      apiUrl = '/api/cmhc-data';
    }
    
    console.log(`🔍 Fetching from API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      // Consistent caching strategy
      next: { revalidate: 86400 }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data from API proxy: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    // Handle both new and old API response formats
    if (responseData.data && Array.isArray(responseData.data)) {
      // New format - processed data is already in the right format
      cachedData = responseData.data;
      return responseData.data;
    } else if (responseData.data && typeof responseData.data === 'string') {
      // Old format - need to parse CSV
      // Parse the CSV data
      const csvData = responseData.data;
      const parsedData = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true
      });
      
      if (!parsedData.data || parsedData.data.length === 0) {
        throw new Error('No data found in the CSV response');
      }
      
      // Identify field names that match what we need
      const sampleRecord = parsedData.data[0];
      const fieldMap = identifyFieldNames(sampleRecord);
      
      // If we couldn't find the bedroom field, try alternative approaches
      if (!fieldMap.Bedrooms) {
        const potentialBedroomFields = ['Type of unit', 'Dwelling type', 'Unit type'];
        
        for (const field of potentialBedroomFields) {
          if (sampleRecord[field]) {
            fieldMap.Bedrooms = field;
            break;
          }
        }
      }
      
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
              const lowerValue = (value || '').toLowerCase();
              
              if (
                lowerKey.includes('date') || 
                lowerKey.includes('period') || 
                lowerKey.includes('year') ||
                lowerKey.includes('ref') ||
                lowerValue.includes('20') // Looking for year like "2023" or "2024"
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
          } else {
            // Look for any field that might contain structure type information
            for (const [key, value] of Object.entries(record)) {
              const lowerKey = key.toLowerCase();
              const lowerValue = (value || '').toLowerCase();
              
              if (
                lowerKey.includes('structure') || 
                lowerKey.includes('building') || 
                lowerKey.includes('type') && !lowerKey.includes('unit')
              ) {
                structureType = value;
                break;
              }
            }
          }
          
          // Calculate data age in months if we have a reference date
          let dataAge: number | undefined = undefined;
          let yearFromRefDate: number | undefined = undefined;
          
          if (refDate) {
            // Try to parse the date - handle different formats
            let refDateObj: Date | null = null;
            
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
            Category: category,
            ...record
          };
        })
        // Filter out records without bedroom info or value
        .filter(record => record.Bedrooms && record.VALUE);
      
      // Find years in the data
      const years = processedData
        .filter(r => r.Year !== undefined)
        .map(r => r.Year as number);
      
      const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a); // Sort descending
      
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
      if (recentRecords.length < 10 && processedData.length >= 10) {
        cachedData = processedData;
        return processedData;
      }

      cachedData = recentRecords;
      return recentRecords;
    } else {
      throw new Error('Invalid response format from API');
    }
  } catch (error) {
    console.error('Error fetching rental data:', error);
    return [];
  }
};

/**
 * Gets the average rent for a specific city and bedroom count
 */
export const getAverage = async (city: string, beds: string, category?: string): Promise<{value: number | null, dataAge?: number}> => {
  try {
    const data = await fetchRentalData();
    
    if (data.length === 0) {
      return { value: null };
    }
    
    // Multiple matching approaches to find relevant data
    
    // Approach 1: Exact match on the city name (case-insensitive)
    let records = data.filter(item => {
      // Clean up GEO field to get just the city name
      const itemCity = item.GEO.split(',')[0].trim();
      const matchesCity = itemCity.toLowerCase() === city.toLowerCase();
      const matchesBeds = item.Bedrooms === beds;
      const matchesCategory = !category || item.Category === category;
      return matchesCity && matchesBeds && matchesCategory;
    });
    
    // Approach 2: If no exact matches, try partial matching
    if (records.length === 0) {
      records = data.filter(item => {
        const matchesCity = item.GEO.toLowerCase().includes(city.toLowerCase());
        const matchesBeds = item.Bedrooms === beds;
        const matchesCategory = !category || item.Category === category;
        return matchesCity && matchesBeds && matchesCategory;
      });
    }
    
    // Approach 3: Try common city name variations
    if (records.length === 0) {
      // Common variations (e.g., St. vs Saint, hyphens, etc.)
      const cityVariations = [];
      
      // Replace St. with Saint and vice versa
      if (city.match(/\bst\b|\bst\./i)) {
        cityVariations.push(city.replace(/\bst\b|\bst\./i, 'Saint'));
      } else if (city.match(/\bsaint\b/i)) {
        cityVariations.push(city.replace(/\bsaint\b/i, 'St.'));
      }
      
      // Try with/without hyphens
      if (city.includes('-')) {
        cityVariations.push(city.replace(/-/g, ' '));
      } else if (city.includes(' ')) {
        cityVariations.push(city.replace(/\s+/g, '-'));
      }
      
      // Special case for common variations
      if (city.toLowerCase() === 'ottawa-gatineau') {
        cityVariations.push('Ottawa', 'Gatineau', 'Ottawa-Gatineau, Ontario part');
      }
      
      if (cityVariations.length > 0) {
        for (const variation of cityVariations) {
          const varRecords = data.filter(item => {
            const itemCity = item.GEO.split(',')[0].trim();
            const matchesCity = itemCity.toLowerCase() === variation.toLowerCase() || 
                             item.GEO.toLowerCase().includes(variation.toLowerCase());
            const matchesBeds = item.Bedrooms === beds;
            const matchesCategory = !category || item.Category === category;
            return matchesCity && matchesBeds && matchesCategory;
          });
          
          if (varRecords.length > 0) {
            records = varRecords;
            break;
          }
        }
      }
    }
    
    // If we still have no matches and we were filtering by category, try without category
    if (records.length === 0 && category) {
      return getAverage(city, beds); // Recursive call without category
    }
    
    // Calculate the average rent
    if (records.length === 0) {
      return { value: null };
    }
    
    let validValues = records
      .map(item => parseFloat(item.VALUE.replace(/[^\d.]/g, '')))
      .filter(value => !isNaN(value));
    
    if (validValues.length === 0) {
      return { value: null };
    }
    
    const sum = validValues.reduce((a, b) => a + b, 0);
    const avg = sum / validValues.length;
    
    // Get the data age from the first record
    const dataAge = records[0].DataAge;
    
    return { 
      value: Math.round(avg), 
      dataAge 
    };
  } catch (error) {
    console.error('Error getting average rent:', error);
    return { value: null };
  }
};

/**
 * Helper function to process records and calculate average
 */
const processRecordsForAverage = (records: RentalRecord[]): {value: number | null, dataAge?: number} => {
  // If we have multiple records, take the average and calculate average age
  if (records.length > 1) {
    const validValues = records
      .map(r => r.VALUE)
      .map(val => parseFloat(val.replace(/[$,]/g, '')))
      .filter(num => !isNaN(num));
    
    if (validValues.length === 0) return { value: null };
    
    const sum = validValues.reduce((a, b) => a + b, 0);
    const avgValue = sum / validValues.length;
    
    // Calculate average data age
    const agesWithValues = records
      .filter(r => r.DataAge !== undefined)
      .map(r => r.DataAge as number);
    
    const avgAge = agesWithValues.length > 0 
      ? Math.round(agesWithValues.reduce((a, b) => a + b, 0) / agesWithValues.length)
      : undefined;
    
    return { value: avgValue, dataAge: avgAge };
  }
  
  // Parse the numeric value from the string (remove $ and ,)
  const value = parseFloat(records[0].VALUE.replace(/[$,]/g, ''));
  return {
    value: isNaN(value) ? null : value,
    dataAge: records[0].DataAge
  };
};

/**
 * Gets all available cities in the dataset
 */
export const getAvailableCities = async (): Promise<string[]> => {
  try {
    const data = await fetchRentalData();
    
    if (data.length === 0) {
      return [];
    }
    
    // Extract unique city names from the GEO field
    const cities = data.map(item => {
      // Extract the city name from the GEO field
      let city = item.GEO;
      
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
    
    return uniqueCities;
  } catch (error) {
    console.error('Error getting available cities:', error);
    return [];
  }
};

/**
 * Gets the available housing categories for a specific city and bedroom count
 */
export const getAvailableCategories = async (city: string, beds: string): Promise<string[]> => {
  try {
    const data = await fetchRentalData();
    
    if (data.length === 0) {
      return [];
    }
    
    // Find records for this city and bedroom count
    const records = data.filter(item => {
      // Clean up GEO field to get just the city name
      const itemCity = item.GEO.split(',')[0].trim();
      const matchesCity = itemCity.toLowerCase() === city.toLowerCase() || 
                        item.GEO.toLowerCase().includes(city.toLowerCase());
      const matchesBeds = item.Bedrooms === beds;
      return matchesCity && matchesBeds;
    });
    
    // Extract unique categories
    const categories = records
      .map(item => item.Category)
      .filter((category): category is string => !!category);
    
    return Array.from(new Set(categories));
  } catch (error) {
    console.error('Error getting available categories:', error);
    return [];
  }
};

// Housing category definitions
export interface HousingCategory {
  name: string;
  description: string;
}

export const HOUSING_CATEGORIES: HousingCategory[] = [
  { name: "Multi-Plex", description: "Small residential buildings with 3-5 apartment units" },
  { name: "Townhouse", description: "Row housing units sharing walls with adjacent units" },
  { name: "Low-Rise", description: "Apartment buildings with 3-5 floors" },
  { name: "Highrise", description: "Apartment buildings with 6 or more floors" }
];

// Mapping from CMHC structure types to our housing categories
const STRUCTURE_CATEGORY_MAP: Record<string, string> = {
  "Row and apartment structures of three units and over": "Multi-Plex",
  "Row structures of three units and over": "Townhouse",
  "Apartment structures of three units and over": "Low-Rise",
  "Apartment structures of six units and over": "Highrise"
};

/**
 * Maps structure type to one of our defined categories
 */
export const mapStructureTypeToCategory = (structureType: string | undefined): string => {
  if (!structureType) return '';
  
  return STRUCTURE_CATEGORY_MAP[structureType] || '';
};

// Add CommonJS exports at the end of the file
// This allows the functions to be imported using require() in CommonJS scripts
// while maintaining the ES module exports for the Next.js application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeBedrooms,
    identifyFieldNames,
    mapStructureTypeToCategory,
    fetchRentalData,
    getAverage,
    getAvailableCities,
    getAvailableCategories,
    ONTARIO_CITIES,
    HOUSING_CATEGORIES
  };
}