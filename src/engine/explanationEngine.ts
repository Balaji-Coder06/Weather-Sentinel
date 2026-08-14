import type { ActivityConfig } from '../types/activity';
import type { ActivityWindowAnalysis, DynamicExplanation, EnvironmentalFactorScores } from '../types/risk';

export class ExplanationEngine {
  /**
   * Generates dynamic, structured explanations citing genuine meteorological drivers.
   */
  public generateExplanations(
    windowAnalysis: ActivityWindowAnalysis,
    factors: EnvironmentalFactorScores,
    config: ActivityConfig,
    durationHours: number
  ): DynamicExplanation[] {
    const explanations: DynamicExplanation[] = [];
    let index = 1;

    const hours = windowAnalysis.hours.map((h) => h.hour);
    const peakHour = windowAnalysis.peakRiskHour.hour;
    const maxRainProb = Math.max(...hours.map((h) => h.precipitationProbability ?? 0));
    const maxPrecipMm = Math.max(...hours.map((h) => h.precipitation ?? 0));
    const maxAppTemp = Math.max(...hours.map((h) => h.apparentTemperature ?? h.temperature ?? 20));
    const maxTemp = Math.max(...hours.map((h) => h.temperature ?? 20));
    const avgHumidity = Math.round(
      hours.reduce((acc, h) => acc + (h.relativeHumidity ?? 50), 0) / hours.length
    );
    const maxGusts = Math.max(...hours.map((h) => h.windGusts ?? h.windSpeed ?? 0));
    const maxWind = Math.max(...hours.map((h) => h.windSpeed ?? 0));
    const maxUv = Math.max(...hours.map((h) => h.uvIndex ?? 0));

    const peakHumidity = peakHour.relativeHumidity ?? avgHumidity;

    // 1. Precipitation explanation
    if (factors.rainRisk >= 40) {
      explanations.push({
        index: index++,
        factor: 'Precipitation Overlap',
        title: `Elevated Rain Probability (${maxRainProb}%)`,
        description: `Precipitation probability peaks at ${maxRainProb}% during ${peakHour.timeFormatted}${
          maxPrecipMm > 0 ? ` with estimated accumulation of ${maxPrecipMm.toFixed(1)} mm` : ''
        }. For ${config.name.toLowerCase()}, surface moisture and water logging significantly increase hazard and interruption risk.`,
        severity: factors.rainRisk >= 70 ? 'critical' : 'elevated',
      });
    } else if (maxRainProb > 25) {
      explanations.push({
        index: index++,
        factor: 'Precipitation Chance',
        title: `Marginal Rain Chance (${maxRainProb}%)`,
        description: `There is a modest ${maxRainProb}% chance of light showers during the activity window.`,
        severity: 'normal',
      });
    }

    // 2. Thermal Stress explanation
    if (factors.heatRisk >= 40) {
      const isExtreme = maxAppTemp >= 36;
      explanations.push({
        index: index++,
        factor: 'Thermal Load',
        title: `High Apparent Temperature (${maxAppTemp.toFixed(1)}°C)`,
        description: `Ambient temperature reaches ${maxTemp.toFixed(1)}°C, but elevated humidity (${peakHumidity}%) drives feels-like heat to ${maxAppTemp.toFixed(1)}°C. This restricts evaporative cooling, accelerating cardiovascular fatigue and dehydration during ${config.name.toLowerCase()}.`,
        severity: isExtreme || factors.heatRisk >= 70 ? 'critical' : 'elevated',
      });
    } else if (maxAppTemp < config.idealTempRange[0] - 5) {
      explanations.push({
        index: index++,
        factor: 'Thermal Deficit',
        title: `Cool / Chilling Conditions (${maxAppTemp.toFixed(1)}°C)`,
        description: `Apparent temperature is below the optimal threshold (${config.idealTempRange[0]}°C). Combined with wind flow, this increases wind-chill discomfort.`,
        severity: 'elevated',
      });
    }

    // 3. Aerodynamic / Wind explanation
    if (factors.windRisk >= 40) {
      explanations.push({
        index: index++,
        factor: 'Wind Dynamics',
        title: `Gust Velocity (${maxGusts.toFixed(0)} km/h)`,
        description: `Sustained winds of ${maxWind.toFixed(0)} km/h with peak gusts up to ${maxGusts.toFixed(0)} km/h create significant aerodynamic resistance and stability challenges for ${config.name.toLowerCase()}.`,
        severity: factors.windRisk >= 70 ? 'critical' : 'elevated',
      });
    }

    // 4. UV Exposure explanation
    if (factors.uvRisk >= 40) {
      explanations.push({
        index: index++,
        factor: 'Solar Radiation',
        title: `High UV Radiation (Index ${maxUv.toFixed(1)})`,
        description: `Solar ultraviolet radiation reaches index ${maxUv.toFixed(1)}, requiring protective measures to prevent sunburn and photokeratitis during sustained outdoor presence.`,
        severity: factors.uvRisk >= 70 ? 'critical' : 'elevated',
      });
    }

    // 5. Duration impact explanation
    if (durationHours >= 2 && (factors.heatRisk >= 35 || factors.rainRisk >= 35 || factors.uvRisk >= 35)) {
      explanations.push({
        index: index++,
        factor: 'Exposure Duration',
        title: `Cumulative Duration Impact (${durationHours} hrs)`,
        description: `A continuous duration of ${durationHours} hours compounds physiological fatigue and increases the statistical window of encountering peak meteorological fluctuations.`,
        severity: durationHours >= 3.5 ? 'elevated' : 'normal',
      });
    }

    // Default favorable condition explanation if all are low
    if (explanations.length === 0) {
      explanations.push({
        index: index++,
        factor: 'Environmental Alignment',
        title: 'Favorable Meteorological Conditions',
        description: `Apparent temperature (${maxAppTemp.toFixed(1)}°C), minimal rain risk (${maxRainProb}%), and light wind (${maxWind.toFixed(0)} km/h) align well with the operational profile for ${config.name.toLowerCase()}.`,
        severity: 'normal',
      });
    }

    return explanations;
  }
}
