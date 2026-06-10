import { ArrowRight, ChevronDown } from "lucide-react";
import worldMap from "@svg-maps/world";

type AudienceCountry = {
  country: string;
  visitors: number;
};

const countryNames: Record<string, string> = {
  DE: "Germany",
  GB: "United Kingdom",
  IN: "India",
  US: "United States"
};

const countryCoordinates: Record<string, { x: number; y: number }> = {
  BR: { x: 359, y: 370 },
  CA: { x: 208, y: 126 },
  DE: { x: 533, y: 144 },
  GB: { x: 496, y: 129 },
  IN: { x: 727, y: 251 },
  US: { x: 230, y: 188 }
};

export function AudienceMap({ countries }: { countries: AudienceCountry[] }) {
  const maxVisitors = Math.max(...countries.map((country) => country.visitors), 1);
  const activeCountryIds = new Set(countries.map((country) => country.country.toLowerCase()));

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8 w-full">
      <div className="flex-1 w-full min-w-0" aria-label="Audience world map">
        <svg className="w-full h-auto drop-shadow-sm" viewBox={worldMap.viewBox} role="img" aria-hidden="true">
          <defs>
            <pattern id="worldDots" width="7" height="7" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.35" fill="currentColor" className="text-muted-foreground/30" />
            </pattern>
            <pattern id="activeWorldDots" width="7" height="7" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.45" fill="currentColor" className="text-primary" />
            </pattern>
          </defs>
          {worldMap.locations.map((location) => (
            <path
              aria-label={location.name}
              className={`transition-colors duration-300 ${
                activeCountryIds.has(location.id)
                  ? "fill-[url(#activeWorldDots)]"
                  : "fill-[url(#worldDots)]"
              }`}
              d={location.path}
              key={location.id}
            />
          ))}
          {countries.map((country) => (
            <circle
              className="fill-primary stroke-background stroke-2 drop-shadow-md"
              cx={countryCoordinates[country.country]?.x ?? 505}
              cy={countryCoordinates[country.country]?.y ?? 333}
              key={country.country}
              r="8"
            />
          ))}
        </svg>
      </div>

      <div className="w-full lg:w-1/3 flex flex-col gap-5">
        {countries.map((country) => {
          const width = Math.max(12, (country.visitors / maxVisitors) * 100);

          return (
            <div className="flex flex-col gap-2" key={country.country}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground font-medium">
                  <span className="text-lg leading-none" role="img" aria-label="flag">
                    {/* Just using country codes or an emoji fallback, simplified */}
                    {country.country}
                  </span>
                  {countryNames[country.country] ?? country.country}
                </span>
                <strong className="font-semibold text-foreground">{country.visitors.toLocaleString("en")}</strong>
              </div>
              <div className="h-2 w-full bg-secondary overflow-hidden rounded-full">
                <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
        <button className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mt-2 p-2 rounded-md hover:bg-muted/50" type="button">
          See More Details
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
