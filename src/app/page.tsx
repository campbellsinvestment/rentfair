'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import ShareButton from '@/app/components/ShareButton';  // Fixed import path
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
  const [showLegend, setShowLegend] = useState<boolean>(false); // For housing categories info

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
      // Fixed: Handle null with optional chaining or passing undefined
      compareRent(cityParam, bedsParam, Number(priceParam), categoryParam || undefined);
    }
  }, [searchParams]);

  // Fetch available categories when city or beds change
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`/api/test-cities?city=${encodeURIComponent(city)}&beds=${encodeURIComponent(beds)}`);
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
      
      // For non-OK responses, handle more carefully
      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        try {
          // Attempt to parse as JSON, but have a fallback
          const errorData = await response.json();
          console.error('🔍 DEBUG-FRONTEND: Error response from API:', errorData);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          // If JSON parsing fails, use the status text
          console.error('🔍 DEBUG-FRONTEND: Failed to parse error response as JSON');
        }
        
        throw new Error(errorMessage);
      }

      // For successful responses, proceed as normal
      const data = await response.json();
      console.log('🔍 DEBUG-FRONTEND: Success! Received comparison data:', data);
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
      console.error('🔍 DEBUG-FRONTEND: Error during comparison:', err);
      
      // Fixed: Type guard for the error
      const error = err as { name?: string; message?: string };
      
      // Special handling for timeout errors
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
    if (!result) return 'bg-gray-100';
    const { percent } = result;
    if (percent > 0.15) return 'bg-red-100 border-red-500';
    if (percent < -0.15) return 'bg-green-100 border-green-500';
    return 'bg-yellow-100 border-yellow-500';
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-bold mb-6 text-center">RentFair</h1>
      <p className="mb-6 text-center text-gray-600">
        Compare your rent to average market rates in Ontario
      </p>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <select
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              {ONTARIO_CITIES.map((cityOption) => (
                <option key={cityOption} value={cityOption}>
                  {cityOption}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="beds" className="block text-sm font-medium text-gray-700 mb-1">
              Bedrooms
            </label>
            <select
              id="beds"
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              {BEDROOM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Rent ($)
            </label>
            <input
              id="price"
              type="number"
              min="0"
              value={price || ''}
              onChange={(e) => setPrice(e.target.valueAsNumber)}
              className="w-full p-2 border rounded"
              required
              placeholder="Enter amount"
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Housing Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border rounded"
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
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          {loading ? 'Comparing...' : 'Compare Rent'}
        </button>
      </form>

      {error && (
        <div className="p-4 mb-4 bg-red-100 border border-red-500 rounded text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className={`p-6 rounded-lg border ${getResultCardClass()} shadow-sm`}>
          <h2 className="text-2xl font-bold mb-4">Results</h2>
          
          {/* Data age warning banner */}
          {result.dataAge && result.dataAge > 6 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-yellow-800 text-sm">
              <p className="font-medium">Data is {result.dataAgeMention}</p>
              <p>Rental prices may have changed since data collection.</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Average Market Rent</p>
              <p className="text-xl font-semibold">${result.average.toFixed(2)}</p>
              {result.adjustmentApplied && (
                <p className="text-xs text-gray-500 mt-1">
                  Est. current: ${result.adjustedAverage?.toFixed(2)}*
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Difference</p>
              <p className="text-xl font-semibold">
                ${result.delta > 0 ? '+' : ''}
                {result.delta.toFixed(2)}
              </p>
              {result.adjustmentApplied && result.adjustedAverage && (
                <p className="text-xs text-gray-500 mt-1">
                  Est. current: ${(price - result.adjustedAverage).toFixed(2)}*
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Percentage</p>
              <p className="text-xl font-semibold">
                {result.percent > 0 ? '+' : ''}
                {(result.percent * 100).toFixed(1)}%
              </p>
              {result.adjustmentApplied && result.adjustedAverage && (
                <p className="text-xs text-gray-500 mt-1">
                  Est. current: {((price - result.adjustedAverage) / result.adjustedAverage * 100).toFixed(1)}%*
                </p>
              )}
            </div>
          </div>
          
          <div className="mt-2">
            {result.percent > 0.15 && (
              <p className="text-red-700 font-medium">
                This rent is above the market average.
              </p>
            )}
            {result.percent < -0.15 && (
              <p className="text-green-700 font-medium">
                This rent is below the market average.
              </p>
            )}
            {result.percent >= -0.15 && result.percent <= 0.15 && (
              <p className="text-yellow-700 font-medium">
                This rent is close to the market average.
              </p>
            )}
            
            {result.category && (
              <p className="mt-2 text-gray-700">
                Housing category: <span className="font-medium">{result.category}</span>
              </p>
            )}
            
            {result.adjustmentApplied && (
              <p className="text-xs text-gray-600 mt-2">
                *Estimated current value is adjusted for data age ({result.dataAgeMention}) using a 5% annual increase model.
              </p>
            )}
          </div>
          <ShareButton percent={result.percent} />
        </div>
      )}

      {/* Housing Category Legend */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Housing Categories</h3>
          <button 
            onClick={() => setShowLegend(!showLegend)}
            className="text-blue-600 text-sm hover:underline focus:outline-none"
          >
            {showLegend ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {showLegend && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <ul className="divide-y divide-gray-200">
              {HOUSING_CATEGORIES.map((cat) => (
                <li key={cat.name} className="py-3 first:pt-0 last:pb-0">
                  <h4 className="font-medium">{cat.name}</h4>
                  <p className="text-sm text-gray-600">{cat.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}