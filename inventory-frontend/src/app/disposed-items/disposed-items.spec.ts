import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { DisposedItems } from './disposed-items';

describe('DisposedItems', () => {
  let component: DisposedItems;
  let fixture: ComponentFixture<DisposedItems>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisposedItems, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DisposedItems);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deviceIcon picks laptop for laptop type', () => {
    const r = {
      id: 1,
      former_asset_id: 9,
      inventory_id: null,
      inventory_name: null,
      asset_type: 'Laptop',
      brand: 'Dell',
      model: 'X1',
      serial_number: null,
      assignment_id: 3,
      user_name: null,
      employee_id: null,
      department: null,
      condition_after: null,
      notes: null,
      disposed_at: '',
    };
    expect(component.deviceIcon(r)).toBe('💻');
  });

  it('deviceLabel combines type brand model', () => {
    const r = {
      id: 1,
      former_asset_id: 9,
      inventory_id: null,
      inventory_name: null,
      asset_type: 'Laptop',
      brand: 'Dell',
      model: 'X1',
      serial_number: null,
      assignment_id: 3,
      user_name: null,
      employee_id: null,
      department: null,
      condition_after: null,
      notes: null,
      disposed_at: '',
    };
    expect(component.deviceLabel(r)).toBe('Laptop — Dell X1');
  });
});
