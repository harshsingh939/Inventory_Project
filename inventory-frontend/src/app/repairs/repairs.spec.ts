import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { Repairs } from './repairs';
import { RepairCostLogRefresh } from '../repair-cost-log-refresh.service';
import { AuthService } from '../auth.service';

describe('Repairs', () => {
  let component: Repairs;
  let fixture: ComponentFixture<Repairs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Repairs, HttpClientTestingModule],
      providers: [
        RepairCostLogRefresh,
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => false,
            isRepairAuthority: () => false,
            getToken: () => null,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Repairs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('assetIcon returns laptop emoji when asset is laptop', () => {
    component.assets = [{ id: 1, asset_type: 'Laptop', brand: 'Dell', model: 'X', status: 'Assigned' }];
    expect(component.assetIcon(1)).toBe('💻');
  });
});
