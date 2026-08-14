import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Timer,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { ALL_ACTIVITIES } from '../engine/activityRegistry';
import { GeocodingService } from '../services/geocodingService';
import type { ActivityId, ActivityPlanContext } from '../types/activity';
import type { GeocodingLocation } from '../types/weather';
import { IconRenderer } from './IconRenderer';

interface ActivityPlannerProps {
  onAnalyze: (plan: ActivityPlanContext) => void;
  isLoading: boolean;
  initialPlan?: ActivityPlanContext | null;
}

export const ActivityPlanner: React.FC<ActivityPlannerProps> = ({
  onAnalyze,
  isLoading,
  initialPlan,
}) => {
  const [selectedActivity, setSelectedActivity] = useState<ActivityId>(
    initialPlan?.activityId || 'outdoor_sports'
  );
  const [searchQuery, setSearchQuery] = useState(initialPlan?.locationName || 'Chennai');
  const [selectedLocation, setSelectedLocation] = useState<GeocodingLocation | null>(
    initialPlan
      ? {
          id: 12345,
          name: initialPlan.locationName.split(',')[0],
          latitude: initialPlan.latitude,
          longitude: initialPlan.longitude,
          timezone: initialPlan.timezone,
          country: 'India',
        }
      : null
  );

  const [searchResults, setSearchResults] = useState<GeocodingLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const getTodayIso = () => new Date().toISOString().split('T')[0];
  const getTomorrowIso = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [date, setDate] = useState<string>(initialPlan?.date || getTomorrowIso());
  const [startTime, setStartTime] = useState<string>(initialPlan?.startTime || '16:00');
  const [durationHours, setDurationHours] = useState<number>(initialPlan?.durationHours || 2);
  const [validationError, setValidationError] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedLocation && searchQuery) {
      GeocodingService.searchLocations(searchQuery)
        .then((results) => {
          if (results.length > 0) {
            setSelectedLocation(results[0]);
            setSearchQuery(GeocodingService.formatLocationName(results[0]));
          }
        })
        .catch(() => {
          // ignore auto-mount search error
        });
    }
  }, []);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedLocation(null);
    setSearchError(null);
    setValidationError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const results = await GeocodingService.searchLocations(value);
        setSearchResults(results);
        setShowDropdown(true);
        if (results.length === 0) {
          setSearchError(`No locations found for "${value}".`);
        }
      } catch (err: any) {
        setSearchError(err.message || 'Error searching location.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectLocation = (loc: GeocodingLocation) => {
    setSelectedLocation(loc);
    setSearchQuery(GeocodingService.formatLocationName(loc));
    setShowDropdown(false);
    setValidationError(null);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep local state synchronized with initialPlan updates
  useEffect(() => {
    if (initialPlan) {
      setSelectedActivity(initialPlan.activityId);
      setSearchQuery(initialPlan.locationName);
      setSelectedLocation({
        id: 12345,
        name: initialPlan.locationName.split(',')[0],
        latitude: initialPlan.latitude,
        longitude: initialPlan.longitude,
        timezone: initialPlan.timezone,
        country: '',
      });
      setDate(initialPlan.date);
      setStartTime(initialPlan.startTime);
      setDurationHours(initialPlan.durationHours);
    }
  }, [initialPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let loc = selectedLocation;
    if (!loc) {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        try {
          const results = await GeocodingService.searchLocations(searchQuery);
          if (results.length > 0) {
            loc = results[0];
            setSelectedLocation(loc);
            setSearchQuery(GeocodingService.formatLocationName(loc));
          } else {
            setValidationError(`No location found matching "${searchQuery}". Please check the spelling.`);
            return;
          }
        } catch {
          setValidationError('Geocoding service unavailable. Please check your network connection.');
          return;
        } finally {
          setIsSearching(false);
        }
      } else {
        setValidationError('Please enter and select a valid location from the search suggestions.');
        return;
      }
    }

    if (!date) {
      setValidationError('Please choose a date for your activity.');
      return;
    }

    if (!startTime) {
      setValidationError('Please specify a start time.');
      return;
    }

    setValidationError(null);

    onAnalyze({
      activityId: selectedActivity,
      locationName: GeocodingService.formatLocationName(loc),
      latitude: loc.latitude,
      longitude: loc.longitude,
      timezone: loc.timezone || 'auto',
      date,
      startTime,
      durationHours,
    });
  };

  const timePresets = [
    { label: '6:00 AM (Early)', value: '06:00' },
    { label: '9:00 AM (Morning)', value: '09:00' },
    { label: '12:00 PM (Noon)', value: '12:00' },
    { label: '4:00 PM (Afternoon)', value: '16:00' },
    { label: '6:00 PM (Evening)', value: '18:00' },
  ];

  const durationPresets = [0.5, 1, 1.5, 2, 3, 4, 6];

  return (
    <section className="planner-card" id="activity-planner-section" aria-labelledby="planner-title">
      <div className="planner-header">
        <div className="planner-header-icon-box">
          <Calendar className="planner-title-icon" size={20} />
        </div>
        <div>
          <h2 id="planner-title" className="planner-title">Plan an Activity</h2>
          <p className="planner-subtitle">
            Configure your target activity, geographic coordinates, and time window for full environmental analysis.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="planner-form" noValidate>
        {/* 1. Activity Selection Grid */}
        <div className="form-group">
          <label className="form-label">
            <span className="label-index">01</span>
            <span className="label-text">Select Activity Profile</span>
          </label>
          <div
            className="activities-grid"
            role="radiogroup"
            aria-label="Activity Profile Selection"
          >
            {ALL_ACTIVITIES.map((act) => {
              const isSelected = act.id === selectedActivity;
              return (
                <button
                  type="button"
                  key={act.id}
                  role="radio"
                  aria-checked={isSelected}
                  className={`activity-select-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedActivity(act.id)}
                  id={`activity-btn-${act.id}`}
                >
                  <div className="activity-btn-top">
                    <div className="activity-btn-icon-wrapper">
                      <IconRenderer name={act.iconName} size={20} />
                    </div>
                    <span className="activity-category-tag">{act.category}</span>
                  </div>
                  <span className="activity-btn-name">{act.name}</span>
                  <span className="activity-btn-desc">{act.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Location Search */}
        <div className="form-group" ref={searchContainerRef}>
          <label className="form-label" htmlFor="location-search-input">
            <span className="label-index">02</span>
            <span className="label-text">Location Coordinates</span>
            {selectedLocation && (
              <span className="coord-badge">
                {selectedLocation.latitude.toFixed(3)}°N, {selectedLocation.longitude.toFixed(3)}°E ({selectedLocation.timezone})
              </span>
            )}
          </label>
          <div className="search-input-wrapper">
            <MapPin className="search-input-icon" size={18} />
            <input
              id="location-search-input"
              type="text"
              className="planner-input with-icon"
              placeholder="Search place name (e.g. Chennai, London, Tokyo)..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              autoComplete="off"
            />
            {isSearching && (
              <Loader2 className="search-spinner animate-spin" size={18} />
            )}
            {searchQuery && !isSearching && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLocation(null);
                  setSearchResults([]);
                }}
                aria-label="Clear location search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Location Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <ul className="search-dropdown-menu" role="listbox" id="location-dropdown">
              {searchResults.map((loc) => (
                <li
                  key={`${loc.id}-${loc.latitude}-${loc.longitude}`}
                  role="option"
                  aria-selected={selectedLocation?.id === loc.id}
                  className="dropdown-item"
                  onClick={() => handleSelectLocation(loc)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectLocation(loc);
                    }
                  }}
                >
                  <div className="dropdown-item-main">
                    <MapPin size={15} className="dropdown-pin-icon" />
                    <span className="dropdown-item-name">{loc.name}</span>
                    {loc.admin1 && (
                      <span className="dropdown-item-admin">{loc.admin1}</span>
                    )}
                    {loc.country && (
                      <span className="dropdown-item-country">{loc.country}</span>
                    )}
                  </div>
                  <span className="dropdown-item-coords">
                    {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                  </span>
                </li>
              ))}
            </ul>
          )}

          {searchError && (
            <p className="field-error-msg" role="alert">
              {searchError}
            </p>
          )}
        </div>

        {/* 3. Date, Time & Duration Matrix */}
        <div className="planner-time-grid">
          <div className="form-subgroup">
            <label className="form-label" htmlFor="activity-date-input">
              <span className="label-index">03</span>
              <span className="label-text">Date</span>
            </label>
            <div className="date-input-wrapper">
              <Calendar className="input-prefix-icon" size={17} />
              <input
                id="activity-date-input"
                type="date"
                className="planner-input with-icon"
                value={date}
                min={getTodayIso()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="date-quick-buttons">
              <button
                type="button"
                className={`quick-pill ${date === getTodayIso() ? 'active' : ''}`}
                onClick={() => setDate(getTodayIso())}
              >
                Today
              </button>
              <button
                type="button"
                className={`quick-pill ${date === getTomorrowIso() ? 'active' : ''}`}
                onClick={() => setDate(getTomorrowIso())}
              >
                Tomorrow
              </button>
            </div>
          </div>

          <div className="form-subgroup">
            <label className="form-label" htmlFor="activity-start-time-input">
              <span className="label-index">04</span>
              <span className="label-text">Start Time</span>
            </label>
            <div className="time-input-wrapper">
              <Clock className="input-prefix-icon" size={17} />
              <input
                id="activity-start-time-input"
                type="time"
                className="planner-input with-icon"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="time-quick-presets">
              {timePresets.map((preset) => (
                <button
                  type="button"
                  key={preset.value}
                  className={`preset-pill ${startTime === preset.value ? 'active' : ''}`}
                  onClick={() => setStartTime(preset.value)}
                >
                  {preset.value}
                </button>
              ))}
            </div>
          </div>

          <div className="form-subgroup">
            <label className="form-label" htmlFor="activity-duration-slider">
              <span className="label-index">05</span>
              <span className="label-text">Duration</span>
              <span className="duration-highlight-badge">
                {durationHours} {durationHours === 1 ? 'Hour' : 'Hours'}
              </span>
            </label>
            <div className="duration-slider-row">
              <Timer className="slider-prefix-icon" size={18} />
              <input
                id="activity-duration-slider"
                type="range"
                min="0.5"
                max="6"
                step="0.5"
                className="planner-slider"
                value={durationHours}
                onChange={(e) => setDurationHours(parseFloat(e.target.value))}
                aria-valuemin={0.5}
                aria-valuemax={6}
                aria-valuenow={durationHours}
              />
            </div>
            <div className="duration-quick-pills">
              {durationPresets.map((dh) => (
                <button
                  type="button"
                  key={dh}
                  className={`preset-pill ${durationHours === dh ? 'active' : ''}`}
                  onClick={() => setDurationHours(dh)}
                >
                  {dh}h
                </button>
              ))}
            </div>
          </div>
        </div>

        {validationError && (
          <div className="validation-alert" role="alert">
            <span>{validationError}</span>
          </div>
        )}

        {/* Submit Action */}
        <div className="planner-actions">
          <button
            type="submit"
            className="btn-analyze-primary"
            disabled={isLoading || (!selectedLocation && !searchQuery.trim())}
            id="analyze-conditions-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>PROCESSING METEOROLOGY...</span>
              </>
            ) : (
              <>
                <span>ANALYZE CONDITIONS</span>
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};
