import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Signals Repair cost history to refetch (e.g. after marking a repair Fixed on Repairs). */
@Injectable({ providedIn: 'root' })
export class RepairCostLogRefresh {
  private readonly bus = new Subject<void>();
  readonly events$ = this.bus.asObservable();

  notify() {
    this.bus.next();
  }
}
