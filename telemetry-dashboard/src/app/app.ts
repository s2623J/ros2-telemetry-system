import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

interface Telemetry {
  battery: number;
  cpu_temp: number;
  uptime: number;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('dashboard');

  telemetry?: Telemetry;
  error?: string;

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.http.get<Telemetry>('http://localhost:5000/telemetry')
      .subscribe({
        next: (data) => {
          this.telemetry = data;
          console.info(`Telemetry data received: ${JSON.stringify(data)}`);
          this.error = undefined;
        },
        error: (err) => {
          console.error('Telemetry fetch failed:', err);
          this.error = 'Unable to load telemetry data.';
        }
      });
  }

}
