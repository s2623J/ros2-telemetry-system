import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs';

interface Telemetry {
  battery: number;
  cpu_temp: number;
  uptime: number;
}

@Component({
  selector: 'telemetry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './telemetry.html',
  styleUrls: ['./telemetry.css'],
})

export class TelemetryComponent implements OnInit {
  telemetry$!: Observable<Telemetry | null>;
  errorMessage = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.telemetry$ = timer(0, 2000).pipe(
      switchMap(() =>
        this.http.get<Telemetry>('http://localhost:5000/telemetry').pipe(
          tap((data) => {
            this.errorMessage = '';
            console.log('Telemetry data received:', data);
          }),
          catchError((error) => {
            console.error('Telemetry fetch failed:', error);
            this.errorMessage = 'Unable to contact telemetry server.';
            return of(null);
          })
        )
      )
    );
  }
}
