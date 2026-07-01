import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  of,
  timer,
  catchError,
  map,
  scan,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';

interface Telemetry {
  battery: number;
  cpu_temp: number;
  uptime: number;
}

interface TelemetrySample extends Telemetry {
  receivedAt: Date;
  healthStatus: 'OK' | 'WARN';
}

interface TelemetryViewModel {
  current: TelemetrySample | null;
  history: TelemetrySample[];
  sampleCount: number;
  averageBattery: number | null;
  maxCpuTemp: number | null;
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
          })
        )
      ),

      scan((history: TelemetrySample[], sample: TelemetrySample | null) => {
        if (!sample) {
          return history;
        }

        return [sample, ...history].slice(0, 20);
      }, []),

      map((history) => this.toViewModel(history)),

      shareReplay({
        bufferSize: 1,
        refCount: true,
      })
    );
  }

  private toTelemetrySample(telemetry: Telemetry): TelemetrySample {
    return {
      ...telemetry,
      receivedAt: new Date(),
      healthStatus: this.getHealthStatus(telemetry),
    };
  }

  private getHealthStatus(telemetry: Telemetry): 'OK' | 'WARN' {
    if (telemetry.battery < 25) {
      return 'WARN';
    }

    if (telemetry.cpu_temp > 75) {
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
      };
    }

    const totalBattery = history.reduce(
      (sum, sample) => sum + sample.battery,
      0
    );

    const maxCpuTemp = Math.max(
      ...history.map((sample) => sample.cpu_temp)
    );

    return {
      current,
      history,
      sampleCount: history.length,
      averageBattery: Math.round(totalBattery / history.length),
      maxCpuTemp,
    };
  }
}