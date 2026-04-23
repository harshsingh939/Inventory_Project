import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetsHub } from './assets-hub';

describe('AssetsHubComponent', () => {
  let component: AssetsHub;
  let fixture: ComponentFixture<AssetsHub>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetsHub],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetsHub);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
