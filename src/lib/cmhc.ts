import Papa from 'papaparse';
import JSZip from 'jszip';

interface RentalRecord {
  GEO: string;
  Bedrooms: string;
  VALUE: string;
  RefDate?: string;  
  DataAge?: number;  
  Year?: number;     
  [key: string]: string | number | undefined;
}

let cachedData: RentalRecord[] | null = null;

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
const normalizeBedrooms = (bedroom: string): string => {
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
const identifyFieldNames = (record: Record<string, string>): Record<string, string> => {
  const fieldMap: Record<string, string> = {
    GEO: '',
    Bedrooms: '',
    VALUE: '',
    RefDate: ''
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
  }
  
  return fieldMap;
};

/**
 * Fetches and processes rental data from Statistics Canada
 */
export const fetchRentalData = async (): Promise<RentalRecord[]> => {
  if (cachedData) return cachedData;
  
  try {
    // Use absolute URL if running on the server side, relative URL if on client
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer ? process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000' : '';
    const apiUrl = `${baseUrl}/api/cmhc-data`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data from API proxy: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (!responseData.data) {
      throw new Error('Invalid response from API proxy');
    }
    
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
        
        return {
          GEO: record[fieldMap.GEO],
          Bedrooms: normalizeBedrooms(bedroomInfo),
          VALUE: record[fieldMap.VALUE],
          RefDate: refDate,
          DataAge: dataAge,
          Year: yearFromRefDate,
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
  } catch (error) {
    console.error('Error fetching rental data:', error);
    return [];
  }
};

/**
 * Gets the average rent for a specific city and bedroom count
 */
export const getAverage = async (city: string, beds: string): Promise<{value: number | null, dataAge?: number}> => {
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
      return matchesCity && matchesBeds;
    });
    
    // Approach 2: If no exact matches, try partial matching
    if (records.length === 0) {
      records = data.filter(item => {
        const matchesCity = item.GEO.toLowerCase().includes(city.toLowerCase());
        const matchesBeds = item.Bedrooms === beds;
        return matchesCity && matchesBeds;
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
          const variationMatches = data.filter(item => {
            return item.GEO.toLowerCase().includes(variation.toLowerCase()) && 
                   item.Bedrooms === beds;
          });
          
          if (variationMatches.length > 0) {
            records = variationMatches;
            break;
          }
        }
      }
    }
    
    // Special case for cities that might be part of metropolitan areas
    if (records.length === 0) {
      const metroAreaMappings: Record<string, string[]> = {
        'Toronto': ['Toronto', 'Toronto CMA', 'Greater Toronto'],
        'Mississauga': ['Toronto', 'Toronto CMA', 'Greater Toronto'],
        'Brampton': ['Toronto', 'Toronto CMA', 'Greater Toronto'],
        'Vaughan': ['Toronto', 'Toronto CMA', 'Greater Toronto'],
        'Markham': ['Toronto', 'Toronto CMA', 'Greater Toronto'],
        'Richmond Hill': ['Toronto', 'Toronto CMA', 'Greater Toronto'],
        'Oakville': ['Toronto', 'Toronto CMA', 'Greater Toronto'],
        'Burlington': ['Hamilton', 'Hamilton CMA'],
        'Ottawa': ['Ottawa-Gatineau', 'Ottawa-Gatineau, Ontario part'],
        'Gatineau': ['Ottawa-Gatineau', 'Ottawa-Gatineau, Quebec part'],
      };
      
      const metroAreas = metroAreaMappings[city] || [];
      
      if (metroAreas.length > 0) {
        for (const metroArea of metroAreas) {
          const metroMatches = data.filter(item => {
            return item.GEO.toLowerCase().includes(metroArea.toLowerCase()) && 
                   item.Bedrooms === beds;
          });
          
          if (metroMatches.length > 0) {
            records = metroMatches;
            break;
          }
        }
      }
    }
    
    // Last resort: Try matching just city without bedroom matching
    if (records.length === 0) {
      const cityOnlyMatches = data.filter(item => 
        item.GEO.toLowerCase().includes(city.toLowerCase())
      );
      
      if (cityOnlyMatches.length > 0) {
        // Group by bedroom type
        const bedroomGroups: Record<string, RentalRecord[]> = {};
        cityOnlyMatches.forEach(record => {
          if (!bedroomGroups[record.Bedrooms]) {
            bedroomGroups[record.Bedrooms] = [];
          }
          bedroomGroups[record.Bedrooms].push(record);
        });
        
        // Try to find the closest bedroom match
        if (Object.keys(bedroomGroups).length > 0) {
          // Map bedroom strings to numeric values for comparison
          const bedroomValue: Record<string, number> = {
            '0': 0, // Bachelor
            '1': 1, // 1 Bedroom  
            '2': 2, // 2 Bedroom
            '3+': 3, // 3+ Bedroom
            '': 0 // Default
          };
          
          const targetValue = bedroomValue[beds] !== undefined ? bedroomValue[beds] : parseInt(beds) || 0;
          
          // Find the closest bedroom type
          let closestBedroom = '';
          let minDifference = Number.MAX_VALUE;
          
          for (const bedroom of Object.keys(bedroomGroups)) {
            const bedValue = bedroomValue[bedroom] !== undefined ? 
              bedroomValue[bedroom] : (parseInt(bedroom) || 0);
            
            const difference = Math.abs(bedValue - targetValue);
            
            if (difference < minDifference) {
              minDifference = difference;
              closestBedroom = bedroom;
            }
          }
          
          if (closestBedroom) {
            return processRecordsForAverage(bedroomGroups[closestBedroom]);
          }
        }
      }
      
      return { value: null };
    }
    
    return processRecordsForAverage(records);
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