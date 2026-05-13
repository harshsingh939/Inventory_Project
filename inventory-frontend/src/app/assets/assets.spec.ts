import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { AssetsHub } from './assets-hub';

describe('AssetsHubComponent', () => {
  let component: AssetsHub;
  let fixture: ComponentFixture<AssetsHub>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetsHub, HttpClientTestingModule, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetsHub);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
