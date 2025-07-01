/**
 * Test script to analyze the Statistics Canada data structure
 */
import { fetchRentalData, getAverage } from './cmhc';

async function testRentalData() {
  console.log('Starting data fetch test...');
  
  try {
    console.log('Fetching rental data from Statistics Canada...');
    const data = await fetchRentalData();
    
    console.log(`\nFetched ${data.length} records`);
    
    if (data.length > 0) {
      // Display data structure from first record
      console.log('\nData structure (first record):');
      const firstRecord = data[0];
      Object.keys(firstRecord).forEach(key => {
        console.log(`${key}: ${firstRecord[key]}`);
      });
      
      // Extract all unique cities from the data
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
      
      console.log('\n=== ACTUAL CITIES AVAILABLE IN CMHC DATA ===');
      console.log(`Found ${uniqueCities.length} unique cities:`);
      console.log(JSON.stringify(uniqueCities, null, 2));
      
      // Also print as array format for easy copying
      console.log('\n=== CITY ARRAY FOR CODE ===');
      console.log(`export const ONTARIO_CITIES = [`);
      uniqueCities.forEach((city, index) => {
        console.log(`  '${city}'${index < uniqueCities.length - 1 ? ',' : ''}`);
      });
      console.log(`];`);
      
      // List bedroom types
      const bedroomTypes = Array.from(new Set(data.map(item => item.Bedrooms))).sort();
      console.log(`\nFound ${bedroomTypes.length} bedroom types:`, bedroomTypes);
      
      // Display years available in the data
      const years = data
        .map(r => r.Year)
        .filter(y => y !== undefined) as number[];
      
      if (years.length > 0) {
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        console.log(`\nData covers years: ${minYear} to ${maxYear}`);
      }
      
      // Test a few specific city/bedroom combinations
      const testCases = [
        { city: 'Toronto', beds: '1' },
        { city: 'Ottawa', beds: '2' },
        { city: 'Hamilton', beds: '0' }
      ];
      
      console.log('\nTesting specific city/bedroom combinations:');
      for (const test of testCases) {
        const avg = await getAverage(test.city, test.beds);
        console.log(`${test.city}, ${test.beds} bedroom: ${avg !== null ? '$' + avg.toFixed(2) : 'No data'}`);
      }
    } else {
      console.error('No data was returned');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testRentalData()
  .then(() => console.log('\nTest completed'))
  .catch(err => console.error('Test failed:', err));