'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ShareButton from '@/app/components/ShareButton';
import PageHead from '@/app/components/PageHead';
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
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const resultsRef = useRef<HTMLDivElement | null>(null);

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
      // Create a controller to abort the request if it takes too long
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
      
      const response = await fetch(
        `/api/compare?city=${encodeURIComponent(cityVal)}&beds=${encodeURIComponent(bedsVal)}&price=${priceVal}` + (categoryVal ? `&category=${encodeURIComponent(categoryVal)}` : ''),
        { signal: controller.signal }
      );
      
      // Clear the timeout as we got a response
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          // Failed to parse error response as JSON
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setResult(data);
      
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
      const error = err as { name?: string; message?: string };
      
      if (error.name === 'AbortError') {
        setError('Request timed out. The server might be busy or experiencing issues.');
      } else {
        setError(error.message || 'An unknown error occurred');
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

  // Scroll to results section when it appears
  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [result]);

  return (
    <div className="home-container">
      <PageHead 
        city={city}
        averageRent={result?.average}
        dataAge={result?.dataAgeMention}
      />
      
      <section className="hero-section">
        <h1 itemProp="name">RentFair</h1>
        <p className="tagline" itemProp="description">
          Compare your rent to average market rates in Ontario
        </p>
        <div className="data-certification-badge">
          <div className="data-badge-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M21 8V20.9932C21 21.5501 20.5552 22 20.0066 22H3.9934C3.44495 22 3 21.556 3 21.0082V2.9918C3 2.45531 3.4487 2 4.00221 2H14.9968L21 8Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M14 2V6.99767C14 7.55097 14.4423 8 14.9914 8H21" stroke="currentColor" strokeWidth="2"/>
              <path d="M7.5 15.5L10.5 18.5L16.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span>Official Statistics Canada Data</span>
        </div>
      </section>

      <div className="data-certification-container">
        <div className="data-certification">
          <div className="certification-text">
            <p className="warning-title">Official Statistics Canada Data</p>
            <p>Data sourced from the Canada Mortgage and Housing Corporation (CMHC) Rental Market Survey.</p>
            <p className="certification-date">Last data update: July 2025</p>
          </div>
          <div className="certification-verify">
            <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301" target="_blank" rel="noopener noreferrer" className="verify-link">
              Verify Source
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="verify-icon">
                <path d="M10 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 4H20V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

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
        <section className={`result-card ${getResultCardClass()}`} ref={resultsRef}>
          <h2>Results</h2>
          
          {/* User's inputted rent - prominently displayed */}
          <div className="user-rent-display">
            <div className="user-rent-content">
              <p className="result-label">Your Monthly Rent</p>
              <p className="result-value primary-value">${formatMoney(price)}</p>
            </div>
          </div>
          
          {/* Comparison highlight - enhanced with icons */}
          <div className="comparison-highlight">
            {result.percent > 0.15 ? (
              <p>
                <span className="indicator-icon" style={{ color: 'var(--danger-color)' }}>↑</span>
                Your rent is <strong style={{ color: 'var(--danger-color)' }}>{Math.abs((result.percent * 100)).toFixed(1)}% above</strong> average market rates
              </p>
            ) : result.percent < -0.15 ? (
              <p>
                <span className="indicator-icon" style={{ color: 'var(--success-color)' }}>↓</span>
                Your rent is <strong style={{ color: 'var(--success-color)' }}>{Math.abs((result.percent * 100)).toFixed(1)}% below</strong> average market rates
              </p>
            ) : (
              <p>
                <span className="indicator-icon" style={{ color: 'var(--neutral-color)' }}>•</span>
                Your rent is <strong style={{ color: 'var(--neutral-color)' }}>close to average</strong> market rates
              </p>
            )}
          </div>
          
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
          
          {/* Data age warning banner - moved down */}
          {result.dataAge && result.dataAge > 6 && (
            <div className="data-age-warning">
              <p className="warning-title">Data is {result.dataAgeMention}</p>
              <p>Reflects average of all existing rental contracts (including long-term tenants paying below-market rates), not just current market listings which are typically higher for new renters.</p>
            </div>
          )}
          
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
                <div className="data-info-content">
                  <h4>Data Source</h4>
                  <p>
                    <strong>Canada Mortgage and Housing Corporation (CMHC)</strong> official rental 
                    market surveys across Canadian cities.
                  </p>
                </div>
              </div>
              
              <div className="data-info-section">
                <div className="data-info-content">
                  <h4>Collection Method</h4>
                  <p>
                    Surveys conducted <strong>twice yearly</strong> (April and October) 
                    targeting rental properties with three or more units.
                  </p>
                </div>
              </div>
              
              <div className="data-info-section">
                <div className="data-info-content">
                  <h4>Data Age & Adjustments</h4>
                  <p>
                    For data older than 6 months, we apply an <strong>estimated 5% annual increase</strong> 
                    to better reflect current market conditions.
                  </p>
                </div>
              </div>
              
              <div className="data-info-section">
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