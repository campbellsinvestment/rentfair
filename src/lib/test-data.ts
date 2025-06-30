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
      
      // List all unique cities in Ontario
      const citySet = new Set<string>();
      data.forEach(record => {
        if (record.GEO) citySet.add(record.GEO);
      });
      
      const cities = Array.from(citySet).sort();
      console.log(`\nFound ${cities.length} unique locations:`);
      cities.forEach(city => console.log(`- ${city}`));
      
      // List all unique bedroom types
      const bedroomSet = new Set<string>();
      data.forEach(record => {
        if (record.Bedrooms) bedroomSet.add(record.Bedrooms);
      });
      
      const bedroomTypes = Array.from(bedroomSet).sort();
      console.log(`\nFound ${bedroomTypes.length} bedroom types:`);
      bedroomTypes.forEach(type => console.log(`- ${type}`));
      
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