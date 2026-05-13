import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { EmployeeIdCard } from './employee-id-card';
import { AuthService } from '../auth.service';
import { EmployeeProfileStatusService } from '../employee-profile-status.service';

describe('EmployeeIdCard', () => {
  let component: EmployeeIdCard;
  let fixture: ComponentFixture<EmployeeIdCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeIdCard, HttpClientTestingModule, RouterTestingModule],
      providers: [
        EmployeeProfileStatusService,
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => false,
            isRepairAuthority: () => false,
            isLoggedIn: () => true,
            getProfile: () => ({ id: 1, username: 'tester', email: '', mobile: '', role: 'user' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeIdCard);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
