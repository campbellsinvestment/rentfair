import fs from 'fs';
// Use global fetch instead of node-fetch
// import fetch from 'node-fetch';
import JSZip from 'jszip';
import Papa from 'papaparse';

/**
 * This script directly analyzes the CMHC API response structure
 * to help understand any issues with data fetching
 */
const analyzeDirectResponse = async () => {
  console.log('Starting direct CMHC API analysis...');
  
  try {
    // Step 1: Access the Statistics Canada API directly
    console.log('Step 1: Fetching from Statistics Canada WDS API...');
    const tableId = "34100133";
    const wdsEndpoint = `https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/${tableId}/en`;
    
    console.log(`Calling endpoint: ${wdsEndpoint}`);
    const startTime = Date.now();
    const response = await fetch(wdsEndpoint);
    const responseTime = Date.now() - startTime;
    
    console.log(`API responded in ${responseTime}ms with status ${response.status}`);
    
    if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      return;
    }
    
    const contentType = response.headers.get('content-type');
    console.log(`Response Content-Type: ${contentType}`);
    
    // Parse the response
    const responseBody = await response.text();
    console.log(`Response size: ${(responseBody.length / 1024).toFixed(2)} KB`);
    console.log('Response preview:');
    console.log(responseBody.substring(0, 500) + '...');
    
    let wdsResponse;
    try {
      wdsResponse = JSON.parse(responseBody);
      console.log('Successfully parsed response as JSON');
      console.log('Response structure:', Object.keys(wdsResponse));
      
      if (wdsResponse.status === "SUCCESS" && wdsResponse.object) {
        console.log(`Download URL: ${wdsResponse.object}`);
        
        // Step 2: Download the ZIP file
        console.log('\nStep 2: Downloading ZIP file...');
        const zipStartTime = Date.now();
        const zipResponse = await fetch(wdsResponse.object);
        const zipResponseTime = Date.now() - zipStartTime;
        
        console.log(`ZIP download completed in ${zipResponseTime}ms with status ${zipResponse.status}`);
        
        if (!zipResponse.ok) {
          console.error(`Error downloading ZIP: ${zipResponse.status} - ${zipResponse.statusText}`);
          return;
        }
        
        // Extract ZIP contents
        console.log('\nStep 3: Processing ZIP file...');
        const zipArrayBuffer = await zipResponse.arrayBuffer();
        console.log(`ZIP file size: ${(zipArrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
        
        const zipExtractStartTime = Date.now();
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(zipArrayBuffer);
        const zipExtractTime = Date.now() - zipExtractStartTime;
        
        console.log(`ZIP extraction completed in ${zipExtractTime}ms`);
        console.log(`Files in ZIP: ${Object.keys(zipContent.files).length}`);
        
        // List files in the ZIP
        console.log('\nZIP contents:');
        Object.keys(zipContent.files).forEach(filename => {
          const file = zipContent.files[filename];
          // Fix: Use _data.uncompressedSize or just log the filename
          console.log(`- ${filename}`);
        });
        
        // Find CSV file
        const csvFilename = Object.keys(zipContent.files).find(filename => 
          filename.toLowerCase().endsWith('.csv')
        );
        
        if (csvFilename) {
          console.log(`\nFound CSV file: ${csvFilename}`);
          
          // Extract and analyze CSV
          const csvFile = zipContent.files[csvFilename];
          const csvExtractStartTime = Date.now();
          const csvData = await csvFile.async('string');
          const csvExtractTime = Date.now() - csvExtractStartTime;
          
          console.log(`CSV extraction completed in ${csvExtractTime}ms`);
          console.log(`CSV size: ${(csvData.length / 1024 / 1024).toFixed(2)} MB`);
          
          // Parse the CSV
          console.log('\nStep 4: Parsing CSV data...');
          const csvParseStartTime = Date.now();
          const parsedData = Papa.parse<Record<string, string>>(csvData, {
            header: true,
            skipEmptyLines: true
          });
          const csvParseTime = Date.now() - csvParseStartTime;
          
          console.log(`CSV parsing completed in ${csvParseTime}ms`);
          console.log(`Parsed ${parsedData.data.length} records`);
          
          // Save the first few records for inspection
          const sampleRecords = parsedData.data.slice(0, 5);
          console.log('\nSample CSV records:');
          console.log(JSON.stringify(sampleRecords, null, 2));
          
          // Analyze CSV structure
          if (parsedData.data.length > 0) {
            const firstRecord = parsedData.data[0];
            console.log('\nCSV columns:');
            // Fix: TypeScript knows the type now
            Object.keys(firstRecord).forEach(key => {
              console.log(`- ${key}: ${firstRecord[key]}`);
            });
            
            // Save to file for further inspection
            fs.writeFileSync('cmhc-sample.json', JSON.stringify(sampleRecords, null, 2));
            console.log('\nSaved sample records to cmhc-sample.json');
          }
          
          // Performance summary
          console.log('\nPerformance Summary:');
          console.log(`- API Request: ${responseTime}ms`);
          console.log(`- ZIP Download: ${zipResponseTime}ms`);
          console.log(`- ZIP Extraction: ${zipExtractTime}ms`);
          console.log(`- CSV Parsing: ${csvParseTime}ms`);
          console.log(`- Total Time: ${Date.now() - startTime}ms`);
        } else {
          console.error('No CSV file found in the ZIP archive');
        }
      } else {
        console.error('Invalid WDS response:', wdsResponse);
      }
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      console.log('Response might not be JSON. First 500 characters:');
      console.log(responseBody.substring(0, 500));
    }
    
  } catch (error) {
    console.error('Error during analysis:', error);
  }
};

analyzeDirectResponse();

export {};