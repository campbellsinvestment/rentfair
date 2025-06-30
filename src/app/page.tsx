'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import ShareButton from './components/ShareButton';

// Type for comparison result
interface ComparisonResult {
  average: number;
  delta: number;
  percent: number;
}

// List of Ontario cities
const ONTARIO_CITIES = [
  'Toronto',
  'Ottawa',
  'Mississauga',
  'Brampton',
  'Hamilton',
  'London',
  'Windsor',
  'Kitchener',
  'Kingston',
  'Sudbury',
  'Niagara',
];

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
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Run comparison when query params exist on load
  useEffect(() => {
    const cityParam = searchParams.get('city');
    const bedsParam = searchParams.get('beds');
    const priceParam = searchParams.get('price');

    if (cityParam && bedsParam && priceParam) {
      setCity(cityParam);
      setBeds(bedsParam);
      setPrice(Number(priceParam));
      compareRent(cityParam, bedsParam, Number(priceParam));
    }
  }, [searchParams]);

  const compareRent = async (cityVal: string, bedsVal: string, priceVal: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/compare?city=${encodeURIComponent(cityVal)}&beds=${encodeURIComponent(bedsVal)}&price=${priceVal}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch comparison data');
      }

      const data = await response.json();
      setResult(data);
      
      // Update URL with query parameters
      const params = new URLSearchParams();
      params.set('city', cityVal);
      params.set('beds', bedsVal);
      params.set('price', String(priceVal));
      router.push(`?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast.error(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    compareRent(city, beds, price);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Average Market Rent</p>
              <p className="text-xl font-semibold">${result.average.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Difference</p>
              <p className="text-xl font-semibold">
                ${result.delta > 0 ? '+' : ''}
                {result.delta.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Percentage</p>
              <p className="text-xl font-semibold">
                {result.percent > 0 ? '+' : ''}
                {(result.percent * 100).toFixed(1)}%
              </p>
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
          </div>
          <ShareButton percent={result.percent} />
        </div>
      )}
    </main>
  );
}