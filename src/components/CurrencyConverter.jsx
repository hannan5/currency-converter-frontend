import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://currency-conv-be.onrender.com/api';

const selectClasses =
  'appearance-none cursor-pointer bg-[#1a1a24] border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors';

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Chevron() {
  return (
    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

export default function CurrencyConverter() {
  const [currencies, setCurrencies] = useState([]);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('1');
  const [conversionResult, setConversionResult] = useState(null);
  const [quote, setQuote] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [conversionError, setConversionError] = useState(null);
  const [conversionHistory, setConversionHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const fetchCurrencies = async () => {
      try {
        setIsLoadingCurrencies(true);
        setHasLoadError(false);
        const response = await fetch(`${API_BASE_URL}/currencies`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.json();
        setCurrencies(Object.keys(data.data));
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error fetching currencies:', error);
          setHasLoadError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCurrencies(false);
        }
      }
    };

    fetchCurrencies();
    return () => controller.abort();
  }, [retryCount]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('conversionHistory');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setConversionHistory(parsed);
        }
      }
    } catch (error) {
      console.error('Error reading conversion history:', error);
      localStorage.removeItem('conversionHistory');
    }
  }, []);

  const saveToHistory = (conversion) => {
    setConversionHistory((prev) => {
      const updated = [conversion, ...prev].slice(0, 20);
      try {
        localStorage.setItem('conversionHistory', JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving conversion history:', error);
      }
      return updated;
    });
  };

  const handleConvert = async (e) => {
    e.preventDefault();
    setConversionError(null);

    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      setConversionError('Please enter a valid amount.');
      return;
    }
    if (isHistoricalMode && !selectedDate) {
      setConversionError('Please select a date for the historical rate.');
      return;
    }

    try {
      setIsConverting(true);

      const params = new URLSearchParams({
        base_currency: fromCurrency,
        currencies: toCurrency,
      });

      let response;
      if (isHistoricalMode) {
        params.set('date', selectedDate);
        response = await fetch(`${API_BASE_URL}/currencies/historical?${params}`);
      } else {
        response = await fetch(`${API_BASE_URL}/currencies/latest?${params}`);
      }

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json();

      let rate;
      if (isHistoricalMode) {
        const dateKey = Object.keys(data.data)[0];
        rate = data.data[dateKey]?.[toCurrency];
      } else {
        rate = data.data[toCurrency];
      }
      if (typeof rate !== 'number') {
        throw new Error('Exchange rate missing from response');
      }

      const convertedAmount = (numericAmount * rate).toFixed(2);

      setConversionResult(convertedAmount);
      setQuote({
        from: fromCurrency,
        to: toCurrency,
        rate,
        historicalDate: isHistoricalMode ? selectedDate : null,
      });

      saveToHistory({
        id: makeId(),
        from: fromCurrency,
        to: toCurrency,
        amount: numericAmount,
        result: parseFloat(convertedAmount),
        rate,
        date: new Date().toISOString(),
        historicalDate: isHistoricalMode ? selectedDate : null,
      });
    } catch (error) {
      console.error('Error converting currency:', error);
      setConversionError('Failed to convert currency. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const clearHistory = () => {
    setConversionHistory([]);
    localStorage.removeItem('conversionHistory');
  };

  const clearResult = () => {
    setConversionResult(null);
    setQuote(null);
  };

  const handleFromChange = (value) => {
    setFromCurrency(value);
    clearResult();
  };

  const handleToChange = (value) => {
    setToCurrency(value);
    clearResult();
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    clearResult();
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoadingCurrencies) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center" role="status">
          <div className="h-12 w-12 mx-auto rounded-full border-2 border-white/10 border-t-cyan-400 animate-spin"></div>
          <p className="mt-5 text-sm font-medium text-slate-400">Loading currencies…</p>
        </div>
      </div>
    );
  }

  if (hasLoadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
        <div className="text-center max-w-sm">
          <p className="text-white font-semibold">Couldn't load currencies</p>
          <p className="mt-2 text-sm text-slate-400">
            Please check that the backend is running, then try again.
          </p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="mt-5 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-[#0a0a0f] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 py-6 px-4 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-3 mb-8">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]"></span>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
            Currency Converter
          </h1>
          <span className="ml-auto text-xs text-slate-500 hidden sm:block">
            Real-time &amp; historical rates
          </span>
        </header>

        <div className="flex flex-col gap-6">
          <form onSubmit={handleConvert}>
            <div className="bg-[#12121a] border border-white/[0.08] rounded-2xl p-4 sm:p-6">
              <div className="bg-[#0d0d14] border border-white/[0.06] rounded-xl p-4 focus-within:border-cyan-400/40 transition-colors">
                <label
                  htmlFor="amount"
                  className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  You send
                </label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    className="flex-1 min-w-0 bg-transparent text-2xl sm:text-3xl font-mono text-white placeholder-slate-600 focus:outline-none"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  <div className="relative shrink-0">
                    <select
                      aria-label="From currency"
                      className={selectClasses}
                      value={fromCurrency}
                      onChange={(e) => handleFromChange(e.target.value)}
                    >
                      {currencies.map((currency) => (
                        <option key={currency} value={currency} className="bg-[#1a1a24]">
                          {currency}
                        </option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                </div>
              </div>

              <div className="relative z-10 -my-3 flex justify-center">
                <button
                  type="button"
                  onClick={swapCurrencies}
                  aria-label="Swap currencies"
                  className="h-11 w-11 rounded-full bg-[#1a1a24] border border-white/10 flex items-center justify-center text-cyan-400 hover:text-cyan-300 hover:border-cyan-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </button>
              </div>

              <div className="bg-[#0d0d14] border border-white/[0.06] rounded-xl p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  You get
                </span>
                <div className="flex items-center gap-3 mt-2">
                  <output
                    aria-live="polite"
                    className="flex-1 min-w-0 truncate text-2xl sm:text-3xl font-mono text-white"
                  >
                    {conversionResult !== null ? (
                      conversionResult
                    ) : (
                      <span className="text-slate-600">0.00</span>
                    )}
                  </output>
                  <div className="relative shrink-0">
                    <select
                      aria-label="To currency"
                      className={selectClasses}
                      value={toCurrency}
                      onChange={(e) => handleToChange(e.target.value)}
                    >
                      {currencies.map((currency) => (
                        <option key={currency} value={currency} className="bg-[#1a1a24]">
                          {currency}
                        </option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                </div>
              </div>

              {quote && (
                <p className="mt-3 text-center text-xs font-mono text-slate-500">
                  1 {quote.from} = <span className="text-cyan-400">{quote.rate.toFixed(4)}</span>{' '}
                  {quote.to}
                  {quote.historicalDate && ` · on ${quote.historicalDate}`}
                </p>
              )}

              <div className="mt-5 bg-[#0d0d14] border border-white/[0.06] rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cyan-400 cursor-pointer"
                    checked={isHistoricalMode}
                    onChange={(e) => setIsHistoricalMode(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-slate-300">
                    Use historical exchange rate
                  </span>
                </label>
                {isHistoricalMode && (
                  <input
                    type="date"
                    aria-label="Historical rate date"
                    className="mt-3 w-full bg-[#1a1a24] border border-white/10 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                )}
              </div>

              {conversionError && (
                <p role="alert" className="mt-4 text-sm text-red-400 text-center">
                  {conversionError}
                </p>
              )}

              <button
                type="submit"
                className="mt-5 w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed py-4 text-base font-semibold text-[#0a0a0f] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition-colors shadow-[0_0_24px_rgba(34,211,238,0.25)]"
                disabled={isConverting}
              >
                {isConverting ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Converting…
                  </span>
                ) : (
                  'Convert'
                )}
              </button>
            </div>
          </form>

          <section aria-label="Conversion history">
            <div className="bg-[#12121a] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                  History
                </h2>
                {conversionHistory.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-400 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded transition-colors"
                    onClick={clearHistory}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="max-h-[560px] overflow-y-auto history-scroll">
                {conversionHistory.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-400">No conversions yet</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Your conversions will appear here
                    </p>
                  </div>
                ) : (
                  <ul>
                    {conversionHistory.map((item) => (
                      <li
                        key={item.id}
                        className="px-5 py-3.5 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="font-mono text-sm text-white">
                          {item.amount} {item.from} <span className="text-slate-500">→</span>{' '}
                          {item.result} {item.to}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[11px] font-mono text-slate-400">
                            Rate {item.rate.toFixed(4)}
                          </span>
                          {item.historicalDate && (
                            <span className="rounded border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-300">
                              {item.historicalDate}
                            </span>
                          )}
                          <span className="ml-auto text-[11px] text-slate-500">
                            {formatDateTime(item.date)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
