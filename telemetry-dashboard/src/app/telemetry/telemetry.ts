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
  healthSummary: HealthSummary;
}

interface HealthSummary {
  title: string;
  message: string;
  recommendation: string;
  riskLevel: HealthStatus;
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
        healthSummary: {
          title: 'Waiting for telemetry',
          message: 'No telemetry samples have been received yet.',
          recommendation: 'Verify that the ROS2 publisher and Flask bridge are running.',
          riskLevel: 'OK',
        },
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
      healthSummary: this.generateHealthSummary(history),
    };
  }

  private generateHealthSummary(history: TelemetrySample[]): HealthSummary {
    const current = history[0];

    const recentCriticalCount = history.filter(
      (sample) => sample.healthStatus === 'CRITICAL',
    ).length;

    const recentWarnCount = history.filter((sample) => sample.healthStatus === 'WARN').length;

    const cpuWarnings = history.filter((sample) =>
      sample.anomalies.some((anomaly) => anomaly.message.toLowerCase().includes('cpu')),
    ).length;

    const batteryWarnings = history.filter((sample) =>
      sample.anomalies.some((anomaly) => anomaly.message.toLowerCase().includes('battery')),
    ).length;

    if (current.healthStatus === 'CRITICAL') {
      return {
        title: 'Critical telemetry condition detected',
        message:
          'The robot telemetry indicates a critical health condition in the recent monitoring window.',
        recommendation:
          'Pause operation and inspect the system immediately. Check battery state, CPU temperature, and recent anomaly messages.',
        riskLevel: 'CRITICAL',
      };
    }

    if (recentCriticalCount > 0) {
      return {
        title: 'Recent critical event detected',
        message:
          'The current telemetry is not critical, but at least one recent sample reported a critical condition.',
        recommendation:
          'Continue monitoring closely and inspect the telemetry history for repeated critical events.',
        riskLevel: 'WARN',
      };
    }

    if (current.healthStatus === 'WARN' || recentWarnCount > 0) {
      if (cpuWarnings > batteryWarnings) {
        return {
          title: 'Thermal warning pattern detected',
          message:
            'CPU temperature has exceeded the warning threshold in recent telemetry samples.',
          recommendation:
            'Monitor CPU temperature trends and consider reducing workload or checking cooling behavior.',
          riskLevel: 'WARN',
        };
      }

      if (batteryWarnings > cpuWarnings) {
        return {
          title: 'Battery warning pattern detected',
          message: 'Battery level has entered a warning range in recent telemetry samples.',
          recommendation: 'Prepare for charging, shutdown, or reduced-power operation.',
          riskLevel: 'WARN',
        };
      }

      return {
        title: 'Telemetry warning detected',
        message:
          'One or more telemetry values have entered a warning range in the recent monitoring window.',
        recommendation: 'Review the anomaly list and continue monitoring for repeated warnings.',
        riskLevel: 'WARN',
      };
    }

    return {
      title: 'System operating normally',
      message:
        'No anomalies were detected in the recent telemetry window. Battery and CPU temperature appear to be within expected operating ranges.',
      recommendation: 'Continue normal operation and monitoring.',
      riskLevel: 'OK',
    };
  }
}
