import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, interval } from 'rxjs';
import { apiUrl } from '../api-url';
import { BaseChartDirective } from 'ng2-charts';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title,
  DoughnutController,
  BarController,
  LineController
} from 'chart.js';
import { ChartData, ChartOptions } from 'chart.js';

/** Line chart (live updates) — keep snappy */
const CHART_ANIM_MS = 1100;

/** Bar: stagger each column so they rise one-by-one, then ease into final height */
const barIntroDelay = (dataIndex: number) => dataIndex * 52;

/** Donut: each arc starts slightly after the previous (draw effect) */
const doughnutIntroDelay = (dataIndex: number) => dataIndex * 200;

// ✅ Register all controllers
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title,
  DoughnutController,
  BarController,
  LineController
);

@Component({
  selector: 'app-dashboards',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboards.html',
  styleUrl: './dashboards.css'
})
export class Dashboards implements OnInit {
  private readonly apiBase = apiUrl('');
  private readonly destroyRef = inject(DestroyRef);
  private static readonly LIVE_WINDOW = 18;

  totalInventories = 0;
  totalAssets = 0;
  /** Devices currently checked out (active sessions) */
  totalAssigned = 0;
  activeSessions = 0;
  pendingRepairs = 0;

  /** Named inventories with asset counts for the breakdown table */
  inventoryBreakdown: { id: number | null; name: string; count: number }[] = [];

  recentUsers:  any[] = [];
  recentAssets: any[] = [];
  isLoading = true;

  // ✅ Bar Chart
  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Assets',
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
    animation: {
      duration: 1500,
      easing: 'easeOutBack',
      delay: (ctx) => {
        if (ctx.type === 'data' && ctx.mode === 'default' && typeof ctx.dataIndex === 'number') {
          return barIntroDelay(ctx.dataIndex);
        }
        return 0;
      },
    },
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
    animation: {
      duration: 1700,
      easing: 'easeOutBack',
      animateRotate: true,
      animateScale: true,
      delay: (ctx) => {
        if (ctx.type === 'data' && ctx.mode === 'default' && typeof ctx.dataIndex === 'number') {
          return doughnutIntroDelay(ctx.dataIndex);
        }
        return 0;
      },
    },
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

  /** Rolling window — sessions vs pending repairs (polls every few seconds). */
  lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Active sessions',
        data: [],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.18)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      },
      {
        label: 'Pending repairs',
        data: [],
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(251,191,36,0.12)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 650, easing: 'easeOutCubic' },
    transitions: {
      active: { animation: { duration: 350 } },
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { color: '#94a3b8', boxWidth: 10, usePointStyle: true, padding: 14 },
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#64748b', precision: 0 },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
    },
  };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadDashboard();
    interval(5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.pollLiveMetrics());
  }

  loadDashboard() {
    this.isLoading = true;
    this.cdr.detectChanges();

    Promise.all([
      this.http.get<any[]>(`${this.apiBase}/users`).toPromise(),
      this.http.get<any[]>(`${this.apiBase}/assets`).toPromise(),
      this.http.get<any[]>(`${this.apiBase}/sessions/active`).toPromise(),
      this.http.get<any[]>(`${this.apiBase}/repairs`).toPromise(),
      this.http.get<any[]>(`${this.apiBase}/inventories`).toPromise(),
    ]).then(([users, assets, sessions, repairs, inventories]) => {
      const invList = Array.isArray(inventories) ? inventories : [];
      const assetList = Array.isArray(assets) ? assets : [];

      this.totalInventories = invList.length;
      this.totalAssets = assetList.length;
      this.activeSessions = sessions?.length || 0;
      this.totalAssigned = this.activeSessions;
      this.pendingRepairs = repairs?.filter((r: any) => r.status === 'Pending').length || 0;

      this.recentUsers = (users || []).slice(-5).reverse();
      this.recentAssets = assetList.slice(-5).reverse();

      const counts = new Map<number, number>();
      invList.forEach((inv: any) => counts.set(Number(inv.id), 0));
      let unassigned = 0;
      assetList.forEach((a: any) => {
        const iid = a.inventory_id;
        if (iid == null || iid === '') {
          unassigned++;
        } else {
          const n = Number(iid);
          if (counts.has(n)) counts.set(n, (counts.get(n) || 0) + 1);
          else unassigned++;
        }
      });
      const rows: { id: number | null; name: string; count: number }[] = invList
        .map((inv: any) => ({
          id: Number(inv.id),
          name: String(inv.name || `Inventory #${inv.id}`),
          count: counts.get(Number(inv.id)) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (unassigned > 0) {
        rows.push({ id: null, name: 'Unassigned (no inventory)', count: unassigned });
      }
      this.inventoryBreakdown = rows;

      // ✅ Bar chart — assets per inventory (named rows only; unassigned omitted if empty chart)
      const invChartLabels: string[] = [];
      const invChartData: number[] = [];
      invList.forEach((inv: any) => {
        invChartLabels.push(String(inv.name || `Inv #${inv.id}`));
        invChartData.push(counts.get(Number(inv.id)) ?? 0);
      });
      if (unassigned > 0) {
        invChartLabels.push('Unassigned');
        invChartData.push(unassigned);
      }

      this.barChartData = {
        labels: invChartLabels.length ? invChartLabels : ['No inventories'],
        datasets: [{
          label: 'Assets',
          data: invChartData.length ? invChartData : [0],
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
      assetList.forEach((a: any) => {
        const key = a.status != null && String(a.status).trim() !== '' ? String(a.status) : 'Unknown';
        statusMap[key] = (statusMap[key] || 0) + 1;
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

      this.seedLiveChart(this.activeSessions, this.pendingRepairs);

      this.isLoading = false;
      this.cdr.detectChanges();

    }).catch(err => {
      console.log('Dashboard error:', err);
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  private timeLabel(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private seedLiveChart(sessions: number, pending: number) {
    const t = this.timeLabel();
    this.lineChartData = {
      labels: [t],
      datasets: [
        { ...this.lineChartData.datasets[0], data: [sessions] },
        { ...this.lineChartData.datasets[1], data: [pending] },
      ],
    };
  }

  private appendLivePoint(sessions: number, pending: number) {
    const cap = Dashboards.LIVE_WINDOW;
    const labels = [...(this.lineChartData.labels as string[]), this.timeLabel()].slice(-cap);
    const d0 = [...(this.lineChartData.datasets[0].data as number[]), sessions].slice(-cap);
    const d1 = [...(this.lineChartData.datasets[1].data as number[]), pending].slice(-cap);
    this.lineChartData = {
      labels,
      datasets: [
        { ...this.lineChartData.datasets[0], data: d0 },
        { ...this.lineChartData.datasets[1], data: d1 },
      ],
    };
  }

  private pollLiveMetrics() {
    if (this.isLoading) return;
    forkJoin({
      sessions: this.http.get<any[]>(`${this.apiBase}/sessions/active`),
      repairs: this.http.get<any[]>(`${this.apiBase}/repairs`),
    }).subscribe({
      next: ({ sessions, repairs }) => {
        const s = sessions?.length ?? 0;
        const p = (repairs || []).filter((r: any) => r.status === 'Pending').length;
        this.activeSessions = s;
        this.pendingRepairs = p;
        this.appendLivePoint(s, p);
        this.cdr.detectChanges();
      },
      error: () => {
        /* keep last chart on transient errors */
      },
    });
  }
}