// Use conditional imports for Node.js modules
const fs = typeof window === 'undefined' ? require('fs') : null;
const path = typeof window === 'undefined' ? require('path') : null;
// Fix: Use CommonJS import syntax for fetchStaticData
const fetchStaticDataModule = typeof window === 'undefined' ? require('./fetch-static-data') : null;
const fetchStaticData = fetchStaticDataModule?.fetchStaticData;

// This module handles automated data refresh checks and updates

/**
 * Configuration for the data refresh scheduler
 */
const CONFIG = {
  // Check interval in milliseconds (24 hours)
  CHECK_INTERVAL: 24 * 60 * 60 * 1000,
  
  // Path to the data file
  DATA_FILE: typeof window === 'undefined' ? path.join(process.cwd(), 'public', 'data', 'cmhc-data.json') : '',
  
  // Path to store the last check timestamp
  TIMESTAMP_FILE: typeof window === 'undefined' ? path.join(process.cwd(), 'public', 'data', '.last-check') : '',
};

/**
 * Checks if the data needs to be refreshed based on the last check timestamp
 */
function needsRefresh(): boolean {
  // Skip check in browser environment
  if (typeof window !== 'undefined' || !fs || !path) return false;
  
  try {
    // Check if the timestamp file exists
    if (fs.existsSync(CONFIG.TIMESTAMP_FILE)) {
      const lastCheckTimestamp = parseInt(fs.readFileSync(CONFIG.TIMESTAMP_FILE, 'utf-8'));
      const now = Date.now();
      
      // If the last check was less than CHECK_INTERVAL ago, no refresh needed
      if (!isNaN(lastCheckTimestamp) && (now - lastCheckTimestamp < CONFIG.CHECK_INTERVAL)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking refresh timestamp:', error);
    return true; // Default to refreshing on error
  }
}

/**
 * Updates the last check timestamp
 */
function updateTimestamp(): void {
  // Skip in browser environment
  if (typeof window !== 'undefined' || !fs || !path) return;
  
  try {
    const dir = path.dirname(CONFIG.TIMESTAMP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(CONFIG.TIMESTAMP_FILE, Date.now().toString());
  } catch (error) {
    console.error('Error updating timestamp:', error);
  }
}

/**
 * Gets the metadata from the current data file
 */
function getCurrentMetadata(): any {
  // Skip in browser environment
  if (typeof window !== 'undefined' || !fs || !path) return {};
  
  try {
    if (fs.existsSync(CONFIG.DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf-8'));
      return data.metadata || {};
    }
    
    return {};
  } catch (error) {
    console.error('Error reading current metadata:', error);
    return {};
  }
}

/**
 * Clears the cached data in memory
 * This function will be called after the data file is updated
 */
export function clearCachedData(): void {
  // Skip in browser environment
  if (typeof window !== 'undefined' || !fs || !path) return;
  
  // Signal that the cache should be refreshed by setting a timestamp
  try {
    const cacheSignalFile = path.join(process.cwd(), 'public', 'data', '.cache-invalidated');
    fs.writeFileSync(cacheSignalFile, Date.now().toString());
  } catch (error) {
    console.error('Error clearing cached data:', error);
  }
}

/**
 * Checks for data updates and refreshes if needed
 * Returns true if data was updated, false otherwise
 */
export async function checkForDataUpdates(): Promise<boolean> {
  // Skip in browser environment
  if (typeof window !== 'undefined' || !fs || !path) return false;
  
  console.log('🔄 Checking for CMHC data updates...');
  
  // Skip refresh if not needed based on timestamp
  if (!needsRefresh()) {
    console.log('🔄 Skipping refresh - last check was recent');
    return false;
  }
  
  // Update the timestamp even if we don't end up refreshing the data
  // This prevents repeated checks in a short timeframe
  updateTimestamp();
  
  try {
    // Get current metadata to compare later
    const currentMetadata = getCurrentMetadata();
    
    // Fetch new data from the source
    console.log('🔄 Fetching fresh CMHC data from source...');
    const result = await fetchStaticData();
    
    if (!result.success) {
      console.error('🔄 Failed to fetch fresh data:', result.error);
      return false;
    }
    
    // Read the new metadata to compare with current
    const newData = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf-8'));
    const newMetadata = newData.metadata || {};
    
    // Compare metadata to see if there was a meaningful update
    const hasUpdates = isDataUpdated(currentMetadata, newMetadata);
    
    if (hasUpdates) {
      console.log('🔄 Data was updated. Clearing caches...');
      clearCachedData();
      return true;
    } else {
      console.log('🔄 No meaningful data updates detected');
      return false;
    }
  } catch (error) {
    console.error('🔄 Error checking for updates:', error);
    return false;
  }
}

/**
 * Compares old and new metadata to determine if there was a meaningful update
 */
function isDataUpdated(oldMeta: any, newMeta: any): boolean {
  // If no old metadata, consider it an update
  if (!oldMeta || Object.keys(oldMeta).length === 0) {
    return true;
  }
  
  // Check for different record count
  if (oldMeta.recordCount !== newMeta.recordCount) {
    return true;
  }
  
  // Check for different data year
  if (oldMeta.dataYear !== newMeta.dataYear) {
    return true;
  }
  
  // Check for changes in the unique bedroom types
  if (JSON.stringify(oldMeta.uniqueBedroomTypes) !== JSON.stringify(newMeta.uniqueBedroomTypes)) {
    return true;
  }
  
  // Check for changes in the number of unique cities
  if (oldMeta.uniqueCities !== newMeta.uniqueCities) {
    return true;
  }
  
  return false;
}