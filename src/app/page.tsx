'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import ShareButton from '@/app/components/ShareButton';
import { ONTARIO_CITIES, HOUSING_CATEGORIES } from '@/lib/cmhc';

// Type for comparison result
interface ComparisonResult {
  average: number;
  delta: number;
  percent: number;
  dataAge?: number;
  dataAgeMention: string;
  adjustedAverage?: number;
  adjustmentApplied: boolean;
  category?: string;
}

// Helper function to format money with commas
const formatMoney = (value: number): string => {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Bedroom options
const BEDROOM_OPTIONS = [
  { value: '0', label: 'Bachelor' },
  { value: '1', label: '1 Bedroom' },
  { value: '2', label: '2 Bedroom' },
  { value: '3+', label: '3+ Bedroom' },
];

export default function Home() {
  const [city, setCity] = useState<string>('Toronto');
  const [beds, setBeds] = useState<string>('1');
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [showDataExplanation, setShowDataExplanation] = useState<boolean>(false);
  const [notificationVisible, setNotificationVisible] = useState<boolean>(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Run comparison when query params exist on load
  useEffect(() => {
    const cityParam = searchParams.get('city');
    const bedsParam = searchParams.get('beds');
    const priceParam = searchParams.get('price');
    const categoryParam = searchParams.get('category');

    if (cityParam && bedsParam && priceParam) {
      setCity(cityParam);
      setBeds(bedsParam);
      setPrice(Number(priceParam));
      if (categoryParam) {
        setCategory(categoryParam);
      }
      compareRent(cityParam, bedsParam, Number(priceParam), categoryParam || undefined);
    }
  }, [searchParams]);

  // Fetch available categories when city or beds change
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`/api/cmhc-data?city=${encodeURIComponent(city)}&beds=${encodeURIComponent(beds)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.categories && Array.isArray(data.categories)) {
            setAvailableCategories(data.categories);
          }
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };

    if (city && beds) {
      fetchCategories();
    }
  }, [city, beds]);

  const compareRent = async (cityVal: string, bedsVal: string, priceVal: number, categoryVal?: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 DEBUG-FRONTEND: Starting comparison for:', { city: cityVal, beds: bedsVal, price: priceVal, category: categoryVal });
      
      // Create a controller to abort the request if it takes too long
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
      
      const response = await fetch(
        `/api/compare?city=${encodeURIComponent(cityVal)}&beds=${encodeURIComponent(bedsVal)}&price=${priceVal}` + (categoryVal ? `&category=${encodeURIComponent(categoryVal)}` : ''),
        { signal: controller.signal }
      );
      
      // Clear the timeout as we got a response
      clearTimeout(timeoutId);

      console.log('🔍 DEBUG-FRONTEND: API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          console.error('🔍 DEBUG-FRONTEND: Error response from API:', errorData);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          console.error('🔍 DEBUG-FRONTEND: Failed to parse error response as JSON');
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('🔍 DEBUG-FRONTEND: Success! Received comparison data:', data);
      setResult(data);
      
      // Show success notification
      toast.success('Comparison completed successfully!');
      setNotificationVisible(true);
      setTimeout(() => setNotificationVisible(false), 5000);
      
      // Update URL with query parameters
      const params = new URLSearchParams();
      params.set('city', cityVal);
      params.set('beds', bedsVal);
      params.set('price', String(priceVal));
      if (categoryVal) {
        params.set('category', categoryVal);
      }
      router.push(`?${params.toString()}`);
    } catch (err) {
      console.error('🔍 DEBUG-FRONTEND: Error during comparison:', err);
      
      const error = err as { name?: string; message?: string };
      
      if (error.name === 'AbortError') {
        setError('Request timed out. The server might be busy or experiencing issues.');
        toast.error('Request timed out. Please try again later.');
      } else {
        setError(error.message || 'An unknown error occurred');
        toast.error(error.message || 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    compareRent(city, beds, price, category);
  };

  const getResultCardClass = () => {
    if (!result) return '';
    const { percent } = result;
    if (percent > 0.15) return 'result-card-high';
    if (percent < -0.15) return 'result-card-low';
    return 'result-card-average';
  };

  return (
    <div className="home-container">
      <Toaster position="top-right" />
      
      {notificationVisible && (
        <div className="notification">
          <div className="notification-content">
            <span>Comparison completed successfully!</span>
            <button onClick={() => setNotificationVisible(false)}>×</button>
          </div>
        </div>
      )}
      
      <section className="hero-section">
        <h1>RentFair</h1>
        <p className="tagline">
          Compare your rent to average market rates in Ontario
        </p>
      </section>

      <section className="form-section">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="city">City</label>
              <select
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              >
                {ONTARIO_CITIES.map((cityOption) => (
                  <option key={cityOption} value={cityOption}>
                    {cityOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="beds">Bedrooms</label>
              <select
                id="beds"
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                required
              >
                {BEDROOM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="price">Monthly Rent ($)</label>
              <input
                id="price"
                type="number"
                min="0"
                value={price || ''}
                onChange={(e) => setPrice(e.target.valueAsNumber)}
                required
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="category">
              Housing Category
              <button 
                type="button" 
                className="info-button"
                onClick={() => setShowLegend(!showLegend)}
              >
                ?
              </button>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {HOUSING_CATEGORIES.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Comparing...' : 'Compare Rent'}
          </button>
        </form>
      </section>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {result && (
        <section className={`result-card ${getResultCardClass()}`}>
          <h2>Results</h2>
          
          {/* User's inputted rent - prominently displayed */}
          <div className="user-rent-display">
            <div className="user-rent-content">
              <p className="result-label">Your Monthly Rent</p>
              <p className="result-value primary-value">${formatMoney(price)}</p>
            </div>
          </div>
          
          {/* Data age warning banner */}
          {result.dataAge && result.dataAge > 6 && (
            <div className="data-age-warning">
              <p className="warning-title">Data is {result.dataAgeMention}</p>
              <p>Rental prices may have changed since data collection.</p>
            </div>
          )}
          
          <div className="result-grid">
            <div className="result-item">
              <p className="result-label">Average Market Rent</p>
              <p className="result-value highlight-value">${formatMoney(result.average)}</p>
              {result.adjustmentApplied && (
                <p className="result-adjusted">
                  Est. current: ${formatMoney(result.adjustedAverage!)}*
                </p>
              )}
            </div>
            <div className="result-item">
              <p className="result-label">Difference</p>
              <p className={`result-value ${result.delta > 0 ? 'text-red-600' : result.delta < 0 ? 'text-green-600' : ''} highlight-value`}>
                <span className="market-indicator">
                  {result.delta > 0 ? '↑' : result.delta < 0 ? '↓' : '•'}
                </span>
                ${result.delta > 0 ? '+' : ''}
                {formatMoney(result.delta)}
                <span className="market-status">{result.delta > 0 ? 'above' : result.delta < 0 ? 'below' : 'at'} market</span>
              </p>
              {result.adjustmentApplied && result.adjustedAverage && (
                <p className={`result-adjusted ${(price - result.adjustedAverage) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  <span className="market-indicator">
                    {(price - result.adjustedAverage) > 0 ? '↑' : (price - result.adjustedAverage) < 0 ? '↓' : '•'}
                  </span>
                  Est. current: ${((price - result.adjustedAverage) > 0 ? '+' : '') + formatMoney(price - result.adjustedAverage)}*
                </p>
              )}
            </div>
            <div className="result-item">
              <p className="result-label">Percentage</p>
              <p className={`result-value ${result.percent > 0 ? 'text-red-600' : result.percent < 0 ? 'text-green-600' : ''} highlight-value`}>
                <span className="market-indicator">
                  {result.percent > 0 ? '↑' : result.percent < 0 ? '↓' : '•'}
                </span>
                {result.percent > 0 ? '+' : ''}
                {(result.percent * 100).toFixed(1)}%
                <span className="market-status">{result.percent > 0 ? 'above' : result.percent < 0 ? 'below' : 'at'} market</span>
              </p>
              {result.adjustmentApplied && result.adjustedAverage && (
                <p className={`result-adjusted ${((price - result.adjustedAverage) / result.adjustedAverage) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  <span className="market-indicator">
                    {((price - result.adjustedAverage) / result.adjustedAverage) > 0 ? '↑' : ((price - result.adjustedAverage) / result.adjustedAverage) < 0 ? '↓' : '•'}
                  </span>
                  Est. current: {((price - result.adjustedAverage) / result.adjustedAverage > 0 ? '+' : '') + ((price - result.adjustedAverage) / result.adjustedAverage * 100).toFixed(1)}%*
                </p>
              )}
            </div>
          </div>
          
          {/* Remove these summary lines as they're now part of the ShareButton component */}
          
          {result.category && (
            <p className="category-info">
              Housing category: <span>{result.category}</span>
            </p>
          )}
          
          {result.adjustmentApplied && (
            <p className="adjustment-note">
              *Estimated current value is adjusted for data age ({result.dataAgeMention}) using a 5% annual increase model.
            </p>
          )}
          
          <div className="result-actions">
            <ShareButton percent={result.percent} />
            <button 
              className="data-info-button"
              onClick={() => setShowDataExplanation(!showDataExplanation)}
            >
              About the Data
            </button>
          </div>
        </section>
      )}

      {/* Housing Category Legend */}
      {showLegend && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Housing Categories Explained</h3>
              <button onClick={() => setShowLegend(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <ul className="category-list">
                {HOUSING_CATEGORIES.map((cat) => (
                  <li key={cat.name} className="category-item">
                    <h4>{cat.name}</h4>
                    <p>{cat.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Data Explanation Modal */}
      {showDataExplanation && (
        <div className="modal-overlay">
          <div className="modal-content data-explanation-modal">
            <div className="modal-header">
              <h3>About the Data</h3>
              <button onClick={() => setShowDataExplanation(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="data-info-section">
                <div className="data-info-icon">📊</div>
                <div className="data-info-content">
                  <h4>Data Source</h4>
                  <p>
                    <strong>Canada Mortgage and Housing Corporation (CMHC)</strong> official rental 
                    market surveys across Canadian cities.
                  </p>
                </div>
              </div>
              
              <div className="data-info-section">
                <div className="data-info-icon">🗓️</div>
                <div className="data-info-content">
                  <h4>Collection Method</h4>
                  <p>
                    Surveys conducted <strong>twice yearly</strong> (April and October) 
                    targeting rental properties with three or more units.
                  </p>
                </div>
              </div>
              
              <div className="data-info-section">
                <div className="data-info-icon">⏱️</div>
                <div className="data-info-content">
                  <h4>Data Age & Adjustments</h4>
                  <p>
                    For data older than 6 months, we apply an <strong>estimated 5% annual increase</strong> 
                    to better reflect current market conditions.
                  </p>
                </div>
              </div>
              
              <div className="data-info-section">
                <div className="data-info-icon">⚠️</div>
                <div className="data-info-content">
                  <h4>Limitations to Consider</h4>
                  <ul className="data-limitations-list">
                    <li>May not include basement apartments, single-family homes, or newly built units</li>
                    <li>Regional variations within cities might not be fully reflected in averages</li>
                    <li>Rental incentives (e.g., one month free) may not be factored into reported rents</li>
                    <li>Data for smaller communities may be less comprehensive</li>
                  </ul>
                </div>
              </div>
              
              <div className="data-info-section">
                <div className="data-info-icon">🎯</div>
                <div className="data-info-content">
                  <h4>How to Interpret Results</h4>
                  <div className="interpretation-guide">
                    <div className="interpretation-item good">
                      <span className="badge below">Below Average</span>
                      <p>More than 15% below average: <strong>Good deal</strong></p>
                    </div>
                    <div className="interpretation-item fair">
                      <span className="badge average">Market Rate</span>
                      <p>Within 15% of average: <strong>Fair market rate</strong></p>
                    </div>
                    <div className="interpretation-item high">
                      <span className="badge above">Above Average</span>
                      <p>More than 15% above average: <strong>Premium pricing</strong></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}