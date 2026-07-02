import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer, catchError, map, scan, shareReplay, switchMap, tap } from 'rxjs';

interface Telemetry {
  battery: number;
  cpu_temp: number;
  uptime: number;
}

type HealthStatus = 'OK' | 'WARN' | 'CRITICAL';

interface TelemetryAnomaly {
  severity: 'WARN' | 'CRITICAL';
  message: string;
}

interface TelemetrySample extends Telemetry {
  receivedAt: Date;
  healthStatus: HealthStatus;
  anomalies: TelemetryAnomaly[];
}

interface TelemetryViewModel {
  current: TelemetrySample | null;
  history: TelemetrySample[];
  sampleCount: number;
  averageBattery: number | null;
  maxCpuTemp: number | null;
  okCount: number;
  warnCount: number;
  criticalCount: number;
}

@Component({
  selector: 'telemetry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './telemetry.html',
  styleUrls: ['./telemetry.css'],
})
export class TelemetryComponent {
  errorMessage = '';

  telemetryView$: Observable<TelemetryViewModel>;

  private readonly lowBatteryThreshold = 25;
  private readonly criticalBatteryThreshold = 10;
  private readonly warningCpuTempThreshold = 75;
  private readonly criticalCpuTempThreshold = 85;
  private readonly maxHistoryLength = 20;

  constructor(private http: HttpClient) {
    this.telemetryView$ = timer(0, 2000).pipe(
      switchMap(() =>
        this.http.get<Telemetry>('http://localhost:5000/telemetry').pipe(
          map((telemetry) => this.toTelemetrySample(telemetry)),
          tap((sample) => {
            this.errorMessage = '';
            console.log('Telemetry data received:', sample);
          }),
          catchError((error) => {
            console.error('Telemetry fetch failed:', error);
            this.errorMessage = 'Unable to contact telemetry server.';
            return of(null);
          }),
        ),
      ),

      scan((history: TelemetrySample[], sample: TelemetrySample | null) => {
        if (!sample) {
          return history;
        }

        return [sample, ...history].slice(0, this.maxHistoryLength);
      }, [] as TelemetrySample[]),

      map((history) => this.toViewModel(history)),

      shareReplay({
        bufferSize: 1,
        refCount: true,
      }),
    );
  }

  private toTelemetrySample(telemetry: Telemetry): TelemetrySample {
    const anomalies = this.detectAnomalies(telemetry);
    const healthStatus = this.getHealthStatus(anomalies);

    return {
      ...telemetry,
      receivedAt: new Date(),
      healthStatus,
      anomalies,
    };
  }

  private detectAnomalies(telemetry: Telemetry): TelemetryAnomaly[] {
    const anomalies: TelemetryAnomaly[] = [];

    if (telemetry.battery <= this.criticalBatteryThreshold) {
      anomalies.push({
        severity: 'CRITICAL',
        message: `Battery is critically low at ${telemetry.battery}%`,
      });
    } else if (telemetry.battery < this.lowBatteryThreshold) {
      anomalies.push({
        severity: 'WARN',
        message: `Battery is below ${this.lowBatteryThreshold}%`,
      });
    }

    if (telemetry.cpu_temp >= this.criticalCpuTempThreshold) {
      anomalies.push({
        severity: 'CRITICAL',
        message: `CPU temperature is critically high at ${telemetry.cpu_temp}°C`,
      });
    } else if (telemetry.cpu_temp > this.warningCpuTempThreshold) {
      anomalies.push({
        severity: 'WARN',
        message: `CPU temperature is above ${this.warningCpuTempThreshold}°C`,
      });
    }

    if (telemetry.uptime < 0) {
      anomalies.push({
        severity: 'CRITICAL',
        message: 'Uptime is invalid',
      });
    }

    return anomalies;
  }

  private getHealthStatus(anomalies: TelemetryAnomaly[]): HealthStatus {
    const hasCritical = anomalies.some((anomaly) => anomaly.severity === 'CRITICAL');

    if (hasCritical) {
      return 'CRITICAL';
    }

    const hasWarning = anomalies.some((anomaly) => anomaly.severity === 'WARN');

    if (hasWarning) {
      return 'WARN';
    }

    return 'OK';
  }

  private toViewModel(history: TelemetrySample[]): TelemetryViewModel {
    const current = history[0] ?? null;

    if (history.length === 0) {
      return {
        current,
        history,
        sampleCount: 0,
        averageBattery: null,
        maxCpuTemp: null,
        okCount: 0,
        warnCount: 0,
        criticalCount: 0,
      };
    }

    const totalBattery = history.reduce((sum, sample) => sum + sample.battery, 0);

    const maxCpuTemp = Math.max(...history.map((sample) => sample.cpu_temp));

    const okCount = history.filter((sample) => sample.healthStatus === 'OK').length;

    const warnCount = history.filter((sample) => sample.healthStatus === 'WARN').length;

    const criticalCount = history.filter((sample) => sample.healthStatus === 'CRITICAL').length;

    return {
      current,
      history,
      sampleCount: history.length,
      averageBattery: Math.round(totalBattery / history.length),
      maxCpuTemp,
      okCount,
      warnCount,
      criticalCount,
    };
  }
}
