import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BaseChartDirective } from 'ng2-charts';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  DoughnutController,
  BarController
} from 'chart.js';
import { ChartData, ChartOptions } from 'chart.js';

// ✅ Register all controllers
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  DoughnutController,
  BarController
);

@Component({
  selector: 'app-dashboards',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboards.html',
  styleUrl: './dashboards.css'
})
export class Dashboards implements OnInit {
  private apiUrl = 'http://localhost:3000/api';

  totalUsers     = 0;
  totalAssets    = 0;
  activeSessions = 0;
  pendingRepairs = 0;

  recentUsers:  any[] = [];
  recentAssets: any[] = [];
  isLoading = true;

  // ✅ Bar Chart
  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Employees',
      data: [],
      backgroundColor: [
        'rgba(56,189,248,0.7)',
        'rgba(34,197,94,0.7)',
        'rgba(250,204,21,0.7)',
        'rgba(239,68,68,0.7)',
        'rgba(168,85,247,0.7)',
      ],
      borderColor: ['#38bdf8','#22c55e','#facc15','#ef4444','#a855f7'],
      borderWidth: 2,
      borderRadius: 8,
    }]
  };

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid:  { color: 'rgba(255,255,255,0.05)' }
      },
      y: {
        ticks: { color: '#64748b', stepSize: 1 },
        grid:  { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  // ✅ Doughnut Chart
  doughnutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        'rgba(34,197,94,0.8)',
        'rgba(250,204,21,0.8)',
        'rgba(239,68,68,0.8)',
        'rgba(56,189,248,0.8)',
      ],
      borderColor: '#0f172a',
      borderWidth: 3,
    }]
  };

  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#94a3b8',
          padding: 16,
          font: { size: 12 }
        }
      }
    }
  };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.isLoading = true;
    this.cdr.detectChanges();

    Promise.all([
      this.http.get<any[]>(`${this.apiUrl}/users`).toPromise(),
      this.http.get<any[]>(`${this.apiUrl}/assets`).toPromise(),
      this.http.get<any[]>(`${this.apiUrl}/sessions/active`).toPromise(),
      this.http.get<any[]>(`${this.apiUrl}/repairs`).toPromise(),
    ]).then(([users, assets, sessions, repairs]) => {

      this.totalUsers     = users?.length || 0;
      this.totalAssets    = assets?.length || 0;
      this.activeSessions = sessions?.length || 0;
      this.pendingRepairs = repairs?.filter((r: any) => r.status === 'Pending').length || 0;

      this.recentUsers  = (users  || []).slice(-5).reverse();
      this.recentAssets = (assets || []).slice(-5).reverse();

      // ✅ Bar chart — department wise
      const deptMap: any = {};
      (users || []).forEach((u: any) => {
        deptMap[u.department] = (deptMap[u.department] || 0) + 1;
      });

      this.barChartData = {
        labels: Object.keys(deptMap),
        datasets: [{
          label: 'Employees',
          data: Object.values(deptMap),
          backgroundColor: [
            'rgba(56,189,248,0.7)',
            'rgba(34,197,94,0.7)',
            'rgba(250,204,21,0.7)',
            'rgba(239,68,68,0.7)',
            'rgba(168,85,247,0.7)',
          ],
          borderColor: ['#38bdf8','#22c55e','#facc15','#ef4444','#a855f7'],
          borderWidth: 2,
          borderRadius: 8,
        }]
      };

      // ✅ Doughnut chart — asset status
      const statusMap: any = {};
      (assets || []).forEach((a: any) => {
        statusMap[a.status] = (statusMap[a.status] || 0) + 1;
      });

      this.doughnutChartData = {
        labels: Object.keys(statusMap),
        datasets: [{
          data: Object.values(statusMap),
          backgroundColor: [
            'rgba(34,197,94,0.8)',
            'rgba(250,204,21,0.8)',
            'rgba(239,68,68,0.8)',
            'rgba(56,189,248,0.8)',
          ],
          borderColor: '#0f172a',
          borderWidth: 3,
        }]
      };

      this.isLoading = false;
      this.cdr.detectChanges();

    }).catch(err => {
      console.log('Dashboard error:', err);
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }
}